import os
import re
import html
import json
import base64
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import requests
from requests.adapters import HTTPAdapter
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from .music import map_deezer_genre

router = APIRouter(prefix="/api/spotify", tags=["Spotify Integration"])

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

SPOTIFY_SCOPES = (
    "user-read-private "
    "user-read-email "
    "playlist-read-private "
    "playlist-read-collaborative "
    "user-library-read "
    "user-top-read"
)

BASE_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ENV_FILE_PATH = os.path.join(BASE_BACKEND_DIR, ".env")
TRACK_COVER_CACHE_PATH = os.path.join(BASE_BACKEND_DIR, "spotify_track_covers_cache.json")

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

SSR_HEADERS = {
    "User-Agent": "python-requests/2.31.0",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

# Sessão HTTP com pool de conexões persistentes para resolução rápida de capas em paralelo
_HTTP_SESSION = requests.Session()
_HTTP_ADAPTER = HTTPAdapter(pool_connections=32, pool_maxsize=32)
_HTTP_SESSION.mount("https://", _HTTP_ADAPTER)
_HTTP_SESSION.mount("http://", _HTTP_ADAPTER)

# Cache persistente de capas originais de músicas (track_id -> cover_url oficial)
_TRACK_COVER_CACHE: Dict[str, str] = {}


def _load_track_cover_cache():
    global _TRACK_COVER_CACHE
    if os.path.exists(TRACK_COVER_CACHE_PATH):
        try:
            with open(TRACK_COVER_CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _TRACK_COVER_CACHE.update(data)
        except Exception:
            pass


def _save_track_cover_cache():
    try:
        with open(TRACK_COVER_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_TRACK_COVER_CACHE, f, ensure_ascii=False)
    except Exception:
        pass


_load_track_cover_cache()


def _is_valid_original_track_cover(cover_url: str, playlist_cover: str = "") -> bool:
    """
    Verifica se a URL de capa pertence realmente ao álbum/single original da música
    e NÃO é a capa genérica/mosaico da playlist (prefixo ab67706c no Spotify).
    """
    if not cover_url:
        return False
    if playlist_cover and cover_url == playlist_cover:
        return False
    # No CDN do Spotify, 'ab67706c' é capa customizada de playlist e 'ab677570' é avatar de usuário.
    # Capas oficiais de músicas/álbuns usam 'ab67616d'.
    if "ab67706c" in cover_url or "ab677570" in cover_url:
        return False
    return True


def _resolve_single_track_cover(track_id: str, title: str = "", artist: str = "") -> str:
    """
    Obtém a capa original oficial de uma faixa do Spotify via oEmbed (ou fallback no catálogo Deezer).
    """
    if not track_id:
        return ""
    cached = _TRACK_COVER_CACHE.get(track_id)
    if cached and _is_valid_original_track_cover(cached):
        return cached

    # 1. Tenta o endpoint oficial oEmbed da faixa no Spotify
    if re.match(r"^[A-Za-z0-9]{22}$", track_id):
        try:
            resp = _HTTP_SESSION.get(
                f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{track_id}",
                timeout=6,
            )
            if resp.status_code == 200:
                thumb = (resp.json().get("thumbnail_url") or "").strip()
                if thumb:
                    _TRACK_COVER_CACHE[track_id] = thumb
                    return thumb
        except Exception:
            pass

    # 2. Fallback: busca a capa original do single/álbum no catálogo Deezer
    if title:
        clean_title = re.sub(r"\s*[-–(].*$", "", title).strip() or title
        first_artist = (artist or "").split(",")[0].strip()
        queries = [f"{title} {first_artist}".strip()]
        if clean_title != title:
            queries.append(f"{clean_title} {first_artist}".strip())

        for q in queries:
            try:
                d_resp = _HTTP_SESSION.get(
                    f"https://api.deezer.com/search?q={urllib.parse.quote(q)}&limit=1",
                    timeout=5,
                )
                if d_resp.status_code == 200:
                    items = d_resp.json().get("data") or []
                    if items:
                        album = items[0].get("album") or {}
                        cover = (
                            album.get("cover_medium")
                            or album.get("cover_big")
                            or album.get("cover")
                            or ""
                        )
                        if cover:
                            _TRACK_COVER_CACHE[track_id] = cover
                            return cover
            except Exception:
                pass

    return ""


def _ensure_tracks_have_original_covers(
    tracks: List[Dict[str, Any]], playlist_cover: str = ""
) -> bool:
    """
    Garante que todas as músicas da lista tenham sua própria capa original de álbum/single
    (e nunca a imagem da playlist). Resolve em paralelo via ThreadPoolExecutor + Cache.
    Retorna True caso alguma faixa tenha sido atualizada.
    """
    if not tracks:
        return False

    updated = False
    to_resolve: List[Dict[str, Any]] = []

    for tr in tracks:
        tid = tr.get("id") or ""
        current_cover = tr.get("cover") or ""
        if _is_valid_original_track_cover(current_cover, playlist_cover):
            if tid and tid not in _TRACK_COVER_CACHE:
                _TRACK_COVER_CACHE[tid] = current_cover
            continue

        # Verifica se já está no cache em memória
        cached = _TRACK_COVER_CACHE.get(tid)
        if cached and _is_valid_original_track_cover(cached, playlist_cover):
            tr["cover"] = cached
            updated = True
        else:
            to_resolve.append(tr)

    if to_resolve:
        def _resolve_item(tr_obj: Dict[str, Any]) -> str:
            return _resolve_single_track_cover(
                tr_obj.get("id") or "",
                tr_obj.get("title") or "",
                tr_obj.get("artist") or "",
            )

        with ThreadPoolExecutor(max_workers=24) as executor:
            resolved_covers = list(executor.map(_resolve_item, to_resolve))

        for tr_obj, new_cover in zip(to_resolve, resolved_covers):
            if new_cover:
                tr_obj["cover"] = new_cover
                updated = True
            elif tr_obj.get("cover") == playlist_cover:
                tr_obj["cover"] = ""
                updated = True

        _save_track_cover_cache()

    return updated


def _is_liked_songs_playlist_name(name: str) -> bool:
    """Verifica se o nome de uma playlist corresponde explicitamente a Músicas Curtidas."""
    norm = (name or "").strip().lower()
    return norm in (
        "músicas curtidas",
        "musicas curtidas",
        "liked songs",
        "curtidas",
        "minhas curtidas",
        "favoritas",
        "músicas favoritas",
    )


def _load_env_file():
    """Carrega variáveis de um arquivo .env local caso exista."""
    if os.path.exists(ENV_FILE_PATH):
        try:
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
        except Exception as e:
            print(f"[Spotify Env Warning] Erro ao ler .env: {e}")


_load_env_file()


def get_spotify_config() -> Dict[str, str]:
    _load_env_file()
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get(
        "SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/api/spotify/callback"
    ).strip()
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173").strip()
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "frontend_url": frontend_url,
    }


class SpotifyCredentialsPayload(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: Optional[str] = "http://127.0.0.1:8000/api/spotify/callback"


class SpotifyDirectConnectPayload(BaseModel):
    spotify_url: Optional[str] = ""
    spotify_identity: Optional[str] = ""
    playlist_url: Optional[str] = ""


class SpotifyImportPlaylistPayload(BaseModel):
    playlist_url: str


class SpotifyToggleLikedTrackPayload(BaseModel):
    id: str
    title: str
    artist: str
    album: Optional[str] = ""
    duration: Optional[int] = 0
    cover: Optional[str] = ""
    preview: Optional[str] = ""
    external_url: Optional[str] = ""


def _normalize_text(val: str) -> str:
    if not val:
        return ""
    return val.strip().lower()


def _match_track_with_user_studio(
    title: str, artist: str, user_songs: List[models.Song]
) -> Optional[Dict[str, Any]]:
    """
    Cruza uma faixa do Spotify com as músicas que o usuário já separou no EasyCovers Studio.
    """
    norm_title = _normalize_text(title)
    norm_artist = _normalize_text(artist)
    for s in user_songs or []:
        s_title = _normalize_text(s.name)
        s_artist = _normalize_text(s.artist)
        if not s_title:
            continue
        title_match = (
            s_title == norm_title
            or (len(norm_title) > 3 and norm_title in s_title)
            or (len(s_title) > 3 and s_title in norm_title)
        )
        artist_match = (
            not norm_artist
            or not s_artist
            or s_artist == norm_artist
            or norm_artist in s_artist
            or s_artist in norm_artist
        )
        if title_match and artist_match:
            return {
                "id": s.id,
                "name": s.name,
                "artist": s.artist,
                "genre": s.genre,
                "instrument": s.instrument,
                "original_key": (
                    s.original_key.value
                    if hasattr(s.original_key, "value")
                    else str(s.original_key)
                ),
                "folder": s.folder_path,
                "folder_path": s.folder_path,
                "cover_image_url": s.cover_image_url,
            }
    return None


def _get_saved_playlists(user: models.User) -> List[Dict[str, Any]]:
    if not getattr(user, "spotify_playlists_json", None):
        return []
    try:
        data = json.loads(user.spotify_playlists_json)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_user_playlists(user: models.User, playlists: List[Dict[str, Any]]):
    user.spotify_playlists_json = json.dumps(playlists, ensure_ascii=False)


def _get_saved_liked_tracks(user: models.User) -> List[Dict[str, Any]]:
    if not getattr(user, "spotify_liked_tracks_json", None):
        return []
    try:
        data = json.loads(user.spotify_liked_tracks_json)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_user_liked_tracks(user: models.User, tracks: List[Dict[str, Any]]):
    user.spotify_liked_tracks_json = json.dumps(tracks, ensure_ascii=False)


def _parse_spotify_url(raw_url: str) -> Dict[str, str]:
    """
    Identifica estritamente o tipo (user, playlist, album, track) e o ID a partir de um link oficial do Spotify.
    Suporta links com /intl-pt/, parâmetros ?si=... ou URIs spotify:user:... / spotify:playlist:...
    Retorna type="" caso o link seja inválido.
    """
    cleaned = (raw_url or "").strip()
    if not cleaned:
        return {"type": "", "id": ""}

    # Formato URI: spotify:user:31i6mxd... ou spotify:playlist:37i9dQZF...
    uri_match = re.match(
        r"^spotify:(user|playlist|album|track):([A-Za-z0-9._-]+)$", cleaned
    )
    if uri_match:
        return {"type": uri_match.group(1), "id": uri_match.group(2)}

    # Formato URL oficial: https://open.spotify.com/(intl-xx/)?(embed/)?(user|playlist|album|track)/{id}
    url_match = re.search(
        r"^https?://(?:open|play)\.spotify\.com/(?:intl-[a-zA-Z-]+/)?(?:embed/)?(user|playlist|album|track)/([A-Za-z0-9._-]+)(?:\?.*)?$",
        cleaned,
    )
    if url_match:
        return {"type": url_match.group(1), "id": url_match.group(2)}

    return {"type": "", "id": ""}


def _fetch_real_spotify_playlist(
    raw_url_or_id: str,
    entity_type_override: str = "",
    resolve_all_covers: bool = True,
) -> Dict[str, Any]:
    """
    Extrai os dados reais de uma Playlist, Álbum ou Faixa pública do Spotify
    diretamente via página de Embed + SSR + oEmbed do Spotify, garantindo que
    CADA MÚSICA tenha sua própria capa original de álbum/single (e não a capa da playlist).
    """
    if entity_type_override and re.match(r"^[A-Za-z0-9._-]+$", raw_url_or_id):
        entity_type = entity_type_override
        entity_id = raw_url_or_id
    else:
        parsed = _parse_spotify_url(raw_url_or_id)
        entity_type = parsed["type"]
        entity_id = parsed["id"]

    if entity_type not in ("playlist", "album", "track") or not entity_id:
        raise ValueError(
            "Link inválido. Por favor, cole um link válido do Spotify (ex: https://open.spotify.com/user/... ou https://open.spotify.com/playlist/...) e tente novamente."
        )

    embed_url = f"https://open.spotify.com/embed/{entity_type}/{entity_id}"
    resp = _HTTP_SESSION.get(embed_url, headers=BROWSER_HEADERS, timeout=12)
    if resp.status_code != 200:
        raise ValueError(
            "Não foi possível encontrar essa playlist/música no Spotify. Verifique se o link está correto e se ela é pública, e tente novamente."
        )

    next_match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', resp.text, re.DOTALL
    )
    if not next_match:
        raise ValueError(
            "Link do Spotify inválido ou conteúdo indisponível. Verifique o link e tente novamente."
        )

    next_data = json.loads(next_match.group(1))
    entity = (
        next_data.get("props", {})
        .get("pageProps", {})
        .get("state", {})
        .get("data", {})
        .get("entity", {})
    )

    if not entity or not (entity.get("name") or entity.get("title")):
        raise ValueError(
            "Playlist ou música não encontrada no Spotify. Verifique se o link está correto e tente novamente."
        )

    title = html.unescape(entity.get("name") or entity.get("title") or "Playlist do Spotify").strip()
    owner = html.unescape(entity.get("subtitle") or "Spotify").strip()

    # Extrai capa oficial da playlist/álbum/faixa
    cover_sources = (entity.get("coverArt") or {}).get("sources") or []
    cover_url = cover_sources[0].get("url") if cover_sources else ""

    if not cover_url:
        try:
            oembed_resp = _HTTP_SESSION.get(
                f"https://open.spotify.com/oembed?url=https://open.spotify.com/{entity_type}/{entity_id}",
                timeout=6,
            )
            if oembed_resp.status_code == 200:
                cover_url = oembed_resp.json().get("thumbnail_url") or ""
        except Exception:
            pass

    # Se for playlist, busca o HTML SSR da playlist para extrair rapidamente as capas originais das 30 primeiras faixas
    # e o nome real do dono da playlist
    ssr_track_covers: Dict[str, str] = {}
    if entity_type == "playlist":
        try:
            ssr_resp = _HTTP_SESSION.get(
                f"https://open.spotify.com/playlist/{entity_id}",
                headers=SSR_HEADERS,
                timeout=8,
            )
            if ssr_resp.status_code == 200:
                ssr_html = ssr_resp.text
                owner_match = re.search(
                    r'<a[^>]+href="/user/[^"]+"[^>]*>([^<]+)</a>', ssr_html
                )
                if owner_match:
                    extracted_owner = html.unescape(owner_match.group(1)).strip()
                    if extracted_owner:
                        owner = extracted_owner

                pairs = re.findall(
                    r'src=["\'](https://i\.scdn\.co/image/ab67616d[A-Za-z0-9]+)["\'].{1,600}?href=["\']/track/([A-Za-z0-9]{22})["\']',
                    ssr_html,
                    re.DOTALL,
                )
                for img_url, tid in pairs:
                    hi_res = img_url.replace("ab67616d00004851", "ab67616d00001e02")
                    ssr_track_covers[tid] = hi_res
                    _TRACK_COVER_CACHE[tid] = hi_res
        except Exception:
            pass

    tracks = []

    if entity_type == "track":
        artists_list = entity.get("artists") or []
        artist_name = (
            ", ".join(a.get("name", "") for a in artists_list if a.get("name"))
            or entity.get("subtitle")
            or "Artista"
        )
        duration_sec = int((entity.get("duration") or 0) / 1000)
        preview_url = (entity.get("audioPreview") or {}).get("url") or ""
        track_cover = cover_url or _resolve_single_track_cover(entity_id, title, artist_name)
        tracks.append({
            "id": entity.get("id") or entity_id,
            "title": title,
            "artist": artist_name,
            "album": title,
            "duration": duration_sec,
            "cover": track_cover,
            "preview": preview_url,
            "suggested_genre": "Rock",
            "original_key": "Unknown",
            "external_url": f"https://open.spotify.com/track/{entity_id}",
        })
        return {
            "id": f"sp_single_{entity_id}",
            "name": f"🎵 {title} — {artist_name}",
            "description": "Faixa importada diretamente via link do Spotify.",
            "cover": track_cover,
            "tracks_total": 1,
            "owner": artist_name,
            "public": True,
            "external_url": f"https://open.spotify.com/track/{entity_id}",
            "tracks": tracks,
        }

    raw_track_list = entity.get("trackList") or []
    for idx, item in enumerate(raw_track_list):
        if not item:
            continue
        uri = item.get("uri") or ""
        t_id = (
            uri.split(":")[-1]
            if ":" in uri
            else (item.get("uid") or f"{entity_id}_{idx}")
        )
        t_title = html.unescape(item.get("title") or "Sem título").strip()
        t_artist = html.unescape((item.get("subtitle") or "Artista").replace("\u00a0", " ")).strip()
        t_duration = int((item.get("duration") or 0) / 1000)
        t_preview = (item.get("audioPreview") or {}).get("url") or ""

        # Para álbum, a capa da faixa é a própria capa do álbum; para playlist, usa a capa individual da música!
        if entity_type == "album":
            individual_cover = cover_url
        else:
            individual_cover = (
                ssr_track_covers.get(t_id)
                or _TRACK_COVER_CACHE.get(t_id)
                or ""
            )

        tracks.append({
            "id": t_id,
            "title": t_title,
            "artist": t_artist,
            "album": title if entity_type == "album" else "",
            "duration": t_duration,
            "cover": individual_cover,
            "preview": t_preview,
            "suggested_genre": "Rock",
            "original_key": "Unknown",
            "external_url": f"https://open.spotify.com/track/{t_id}",
        })

    # Resolve em paralelo as capas originais restantes (ex: faixas 31..100 da playlist)
    if entity_type == "playlist" and resolve_all_covers:
        _ensure_tracks_have_original_covers(tracks, cover_url)
    elif ssr_track_covers:
        _save_track_cover_cache()

    return {
        "id": entity_id,
        "name": title,
        "description": f"Playlist de {owner} • {len(tracks)} faixas no Spotify",
        "cover": cover_url,
        "tracks_total": len(tracks),
        "owner": owner,
        "public": True,
        "external_url": f"https://open.spotify.com/{entity_type}/{entity_id}",
        "tracks": tracks,
    }


def _fetch_real_spotify_user_profile(user_id_slug: str) -> Dict[str, Any]:
    """
    Acessa a página pública de perfil do usuário no Spotify (https://open.spotify.com/user/{id}),
    valida se a conta realmente existe, extrai o Nome Real, Foto de Perfil Real e importa
    automaticamente todas as Playlists Públicas reais do perfil!
    Nota: Usa User-Agent de crawler/SSR para que o Spotify retorne o HTML pré-renderizado
    com o <title> real, og:image e a lista de playlists públicas do perfil.
    """
    profile_url = f"https://open.spotify.com/user/{user_id_slug}"
    ssr_headers = {
        "User-Agent": "python-requests/2.31.0",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    resp = requests.get(profile_url, headers=ssr_headers, timeout=12)

    if resp.status_code != 200:
        raise ValueError(
            "Perfil do Spotify não encontrado! Verifique se o link do perfil está correto e tente novamente."
        )

    html_text = resp.text

    # Verifica o <title> da página (ex: "Lucas Abbade on Spotify" ou "Page not found")
    title_match = re.search(r"<title>(.*?)</title>", html_text, re.IGNORECASE | re.DOTALL)
    raw_title = html.unescape(title_match.group(1)).strip() if title_match else ""

    if (
        not raw_title
        or "page not found" in raw_title.lower()
        or "página não encontrada" in raw_title.lower()
        or "web player" in raw_title.lower()
        or raw_title.lower() == "spotify"
    ):
        raise ValueError(
            "Não encontramos nenhum usuário no Spotify com este link. Verifique o endereço e tente novamente."
        )

    # Limpa sufixos " on Spotify", " no Spotify", " | Spotify"
    display_name = re.sub(
        r"\s+(?:on Spotify|no Spotify|\|\s*Spotify|-\s*Spotify).*$",
        "",
        raw_title,
        flags=re.IGNORECASE,
    ).strip()

    if not display_name:
        display_name = user_id_slug

    # Extrai avatar real do usuário no Spotify (og:image ou i.scdn.co/image/ab677570...)
    avatar_url = ""
    og_img_match = re.search(
        r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
        html_text,
        re.IGNORECASE,
    )
    if og_img_match:
        avatar_url = og_img_match.group(1).strip()
    if not avatar_url:
        scdn_imgs = re.findall(r"https://i\.scdn\.co/image/[A-Za-z0-9]+", html_text)
        if scdn_imgs:
            avatar_url = scdn_imgs[0]

    # Extrai todos os IDs de playlists públicas presentes no perfil do usuário
    playlist_ids = list(dict.fromkeys(re.findall(r"playlist/([A-Za-z0-9]{22})", html_text)))

    playlists = []
    if playlist_ids:
        def _safe_fetch_pl(pid: str):
            try:
                return _fetch_real_spotify_playlist(pid, entity_type_override="playlist")
            except Exception as e:
                print(f"[Spotify User Playlist Fetch Warning] ({pid}): {e}")
                return None

        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(_safe_fetch_pl, playlist_ids[:12]))

        for pl in results:
            if pl and pl.get("tracks_total", 0) > 0:
                # Se o subtitle vier genérico "Spotify", preenche com o nome real do dono do perfil
                if pl.get("owner") in ("Spotify", "", None):
                    pl["owner"] = display_name
                    pl["description"] = f"Playlist de {display_name} • {pl['tracks_total']} faixas no Spotify"
                playlists.append(pl)

    return {
        "spotify_id": user_id_slug,
        "display_name": display_name,
        "profile_url": profile_url,
        "avatar_url": avatar_url,
        "playlists": playlists,
    }


def _get_valid_access_token(user: models.User, db: Session) -> str:
    if not user.spotify_access_token:
        raise HTTPException(status_code=401, detail="Conta do Spotify não vinculada.")

    if user.spotify_access_token == "DIRECT_SPOTIFY_LINK":
        return "DIRECT_SPOTIFY_LINK"

    now = datetime.utcnow()
    if user.spotify_token_expires_at and user.spotify_token_expires_at > (
        now + timedelta(seconds=60)
    ):
        return user.spotify_access_token

    if not user.spotify_refresh_token:
        return user.spotify_access_token

    cfg = get_spotify_config()
    if not cfg["client_id"] or not cfg["client_secret"]:
        return user.spotify_access_token

    auth_str = f"{cfg['client_id']}:{cfg['client_secret']}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

    try:
        resp = requests.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": user.spotify_refresh_token,
            },
            headers={
                "Authorization": f"Basic {b64_auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=10,
        )
        if resp.status_code == 200:
            token_data = resp.json()
            user.spotify_access_token = token_data.get(
                "access_token", user.spotify_access_token
            )
            if token_data.get("refresh_token"):
                user.spotify_refresh_token = token_data["refresh_token"]
            expires_in = int(token_data.get("expires_in", 3600))
            user.spotify_token_expires_at = datetime.utcnow() + timedelta(
                seconds=expires_in
            )
            db.commit()
            db.refresh(user)
            return user.spotify_access_token
    except Exception as e:
        print(f"[Spotify Token Refresh Warning]: {e}")

    return user.spotify_access_token


@router.get("/config-status")
def check_spotify_config():
    cfg = get_spotify_config()
    configured = bool(cfg["client_id"] and cfg["client_secret"])
    return {
        "configured": configured,
        "redirect_uri": cfg["redirect_uri"],
        "client_id_preview": (
            f"{cfg['client_id'][:6]}..." if len(cfg["client_id"]) > 6 else ""
        ),
    }


@router.post("/credentials")
def save_spotify_credentials(payload: SpotifyCredentialsPayload):
    client_id = payload.client_id.strip()
    client_secret = payload.client_secret.strip()
    redirect_uri = (
        payload.redirect_uri or "http://127.0.0.1:8000/api/spotify/callback"
    ).strip()

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400, detail="Client ID e Client Secret são obrigatórios."
        )

    os.environ["SPOTIFY_CLIENT_ID"] = client_id
    os.environ["SPOTIFY_CLIENT_SECRET"] = client_secret
    os.environ["SPOTIFY_REDIRECT_URI"] = redirect_uri

    env_dict = {}
    if os.path.exists(ENV_FILE_PATH):
        try:
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env_dict[k.strip()] = v.strip()
        except Exception:
            pass

    env_dict["SPOTIFY_CLIENT_ID"] = client_id
    env_dict["SPOTIFY_CLIENT_SECRET"] = client_secret
    env_dict["SPOTIFY_REDIRECT_URI"] = redirect_uri

    try:
        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            for k, v in env_dict.items():
                f.write(f"{k}={v}\n")
    except Exception as e:
        print(f"[Spotify Env Save Warning]: {e}")

    return {
        "status": "success",
        "message": "Credenciais do Spotify salvas com sucesso!",
        "redirect_uri": redirect_uri,
    }


@router.get("/auth-url")
def get_spotify_auth_url(
    user_id: int = Query(..., description="ID do usuário no EasyCovers"),
    return_to: str = Query(
        "/profile", description="Rota do frontend para retorno após OAuth"
    ),
):
    cfg = get_spotify_config()
    if not cfg["client_id"] or not cfg["client_secret"]:
        return {
            "status": "missing_credentials",
            "configured": False,
            "redirect_uri": cfg["redirect_uri"],
        }

    state_payload = json.dumps({"user_id": user_id, "return_to": return_to})
    state_b64 = base64.urlsafe_b64encode(state_payload.encode("utf-8")).decode("utf-8")

    params = {
        "client_id": cfg["client_id"],
        "response_type": "code",
        "redirect_uri": cfg["redirect_uri"],
        "scope": SPOTIFY_SCOPES,
        "state": state_b64,
        "show_dialog": "true",
    }
    auth_url = f"{SPOTIFY_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return {
        "status": "ok",
        "configured": True,
        "auth_url": auth_url,
        "redirect_uri": cfg["redirect_uri"],
    }


@router.get("/callback")
def spotify_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    cfg = get_spotify_config()
    frontend_url = cfg["frontend_url"].rstrip("/")

    user_id = None
    return_to = "/profile"
    if state:
        try:
            decoded = base64.urlsafe_b64decode(state.encode("utf-8")).decode("utf-8")
            state_data = json.loads(decoded)
            user_id = state_data.get("user_id")
            return_to = state_data.get("return_to") or "/profile"
        except Exception as e:
            print(f"[Spotify Callback State Error]: {e}")

    if error or not code or not user_id:
        err_reason = error or "authorization_failed"
        return RedirectResponse(
            url=f"{frontend_url}{return_to}?spotify_error={err_reason}"
        )

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        return RedirectResponse(
            url=f"{frontend_url}{return_to}?spotify_error=user_not_found"
        )

    auth_str = f"{cfg['client_id']}:{cfg['client_secret']}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

    try:
        token_resp = requests.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": cfg["redirect_uri"],
            },
            headers={
                "Authorization": f"Basic {b64_auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=10,
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in", 3600))

        me_resp = requests.get(
            f"{SPOTIFY_API_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        me_resp.raise_for_status()
        me_data = me_resp.json()

        images = me_data.get("images") or []
        avatar_url = images[0].get("url") if images else ""
        external_urls = me_data.get("external_urls") or {}
        profile_url = external_urls.get("spotify") or ""

        user.spotify_id = me_data.get("id") or ""
        user.spotify_display_name = me_data.get("display_name") or user.username
        user.spotify_email = me_data.get("email") or ""
        user.spotify_avatar_url = avatar_url
        user.spotify_profile_url = profile_url
        user.spotify_access_token = access_token
        if refresh_token:
            user.spotify_refresh_token = refresh_token
        user.spotify_token_expires_at = datetime.utcnow() + timedelta(
            seconds=expires_in
        )
        user.spotify_connected_at = datetime.utcnow()

        if profile_url and not user.social_spotify:
            user.social_spotify = profile_url

        if avatar_url and not user.profile_picture_url:
            user.profile_picture_url = avatar_url

        db.commit()
        db.refresh(user)

        sep = "&" if "?" in return_to else "?"
        return RedirectResponse(url=f"{frontend_url}{return_to}{sep}spotify=connected")

    except Exception as e:
        print(f"[Spotify OAuth Callback Error]: {e}")
        sep = "&" if "?" in return_to else "?"
        return RedirectResponse(
            url=f"{frontend_url}{return_to}{sep}spotify_error=token_exchange_failed"
        )


@router.post("/connect-direct/{user_id}")
def connect_spotify_direct(
    user_id: int,
    payload: SpotifyDirectConnectPayload,
    db: Session = Depends(get_db),
):
    """
    Vincula um perfil REAL do Spotify ou importa uma Playlist REAL a partir do link colado pelo usuário.
    Rejeita links inválidos ou inexistentes com mensagem clara de erro (HTTP 400).
    NUNCA preenche com dados genéricos/fictícios.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Coleta os links enviados nos campos
    primary_link = (
        payload.spotify_url
        or payload.playlist_url
        or payload.spotify_identity
        or ""
    ).strip()
    secondary_link = (
        payload.playlist_url
        if primary_link != (payload.playlist_url or "").strip()
        else (payload.spotify_identity or "").strip()
    ).strip()

    if not primary_link:
        raise HTTPException(
            status_code=400,
            detail="Por favor, cole o link do seu Perfil do Spotify (https://open.spotify.com/user/...) ou de uma Playlist sua (https://open.spotify.com/playlist/...) para vincular.",
        )

    parsed_primary = _parse_spotify_url(primary_link)
    if not parsed_primary["type"] or not parsed_primary["id"]:
        raise HTTPException(
            status_code=400,
            detail="Link inválido! Certifique-se de colar um link oficial do Spotify (ex: https://open.spotify.com/user/... ou https://open.spotify.com/playlist/...) e tente novamente.",
        )

    imported_playlists: List[Dict[str, Any]] = []
    spotify_id = ""
    display_name = ""
    avatar_url = ""
    profile_url = ""

    try:
        if parsed_primary["type"] == "user":
            # Extrai perfil real do usuário + todas as playlists públicas do perfil!
            profile_data = _fetch_real_spotify_user_profile(parsed_primary["id"])
            spotify_id = profile_data["spotify_id"]
            display_name = profile_data["display_name"]
            avatar_url = profile_data["avatar_url"]
            profile_url = profile_data["profile_url"]
            imported_playlists.extend(profile_data.get("playlists") or [])

            # Se também enviou um link secundário de playlist específica, importa ela também
            if secondary_link:
                parsed_sec = _parse_spotify_url(secondary_link)
                if parsed_sec["type"] in ("playlist", "album", "track"):
                    extra_pl = _fetch_real_spotify_playlist(secondary_link)
                    imported_playlists = [
                        p for p in imported_playlists if p.get("id") != extra_pl["id"]
                    ]
                    imported_playlists.insert(0, extra_pl)
                elif parsed_sec["type"] == "":
                    raise ValueError(
                        "O link secundário de playlist informado é inválido. Verifique e tente novamente."
                    )

        elif parsed_primary["type"] in ("playlist", "album", "track"):
            # Usuário colou o link de uma Playlist/Álbum/Música
            pl_data = _fetch_real_spotify_playlist(primary_link)
            imported_playlists.append(pl_data)

            # Verifica se o campo secundário tem o link do perfil do usuário
            if secondary_link:
                parsed_sec = _parse_spotify_url(secondary_link)
                if parsed_sec["type"] == "user":
                    profile_data = _fetch_real_spotify_user_profile(parsed_sec["id"])
                    spotify_id = profile_data["spotify_id"]
                    display_name = profile_data["display_name"]
                    avatar_url = profile_data["avatar_url"]
                    profile_url = profile_data["profile_url"]
                    for up in profile_data.get("playlists") or []:
                        if up.get("id") != pl_data["id"]:
                            imported_playlists.append(up)
                else:
                    raise ValueError(
                        "O link de perfil do Spotify informado é inválido. Use o formato https://open.spotify.com/user/... e tente novamente."
                    )

            if not display_name:
                owner = pl_data.get("owner") or ""
                display_name = (
                    owner
                    if owner and owner.lower() != "spotify"
                    else (user.full_name or user.username or "Conta Spotify")
                )
                spotify_id = display_name.lower().replace(" ", "_")
                avatar_url = pl_data.get("cover") or user.profile_picture_url or ""
                profile_url = pl_data.get("external_url") or "https://open.spotify.com"

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível conectar ao link do Spotify informado. Verifique se o link está correto e tente novamente. ({str(e)})",
        )

    # Atualiza os dados reais do Spotify no usuário
    user.spotify_id = spotify_id
    user.spotify_display_name = display_name
    user.spotify_email = user.email
    user.spotify_avatar_url = avatar_url or user.profile_picture_url or ""
    user.spotify_profile_url = profile_url
    user.spotify_access_token = "DIRECT_SPOTIFY_LINK"
    user.spotify_refresh_token = "DIRECT_SPOTIFY_REFRESH"
    user.spotify_token_expires_at = datetime.utcnow() + timedelta(days=3650)
    user.spotify_connected_at = datetime.utcnow()

    # Sempre atualiza o link social do Spotify para o perfil real vinculado
    if profile_url:
        user.social_spotify = profile_url

    # Se o usuário ainda não tinha foto de perfil no EasyCovers e o Spotify trouxe a foto real, aplica!
    if avatar_url and not user.profile_picture_url:
        user.profile_picture_url = avatar_url

    # Salva as playlists reais importadas
    # Quando vincula um perfil (/user/...), usa exatamente as playlists reais daquele perfil
    if parsed_primary["type"] == "user":
        merged_playlists = list(imported_playlists)
    else:
        existing_playlists = _get_saved_playlists(user)
        merged_playlists = list(imported_playlists)
        imported_ids = {p["id"] for p in merged_playlists}
        for ep in existing_playlists:
            if ep.get("id") not in imported_ids:
                merged_playlists.append(ep)
    _save_user_playlists(user, merged_playlists)

    # Músicas Curtidas: NUNCA copia faixas de uma playlist comum para "Músicas Curtidas"!
    # Apenas preenche automaticamente se o usuário tiver uma playlist explicitamente chamada "Músicas Curtidas" / "Liked Songs".
    liked_playlist_tracks: List[Dict[str, Any]] = []
    for pl in merged_playlists:
        if _is_liked_songs_playlist_name(pl.get("name", "")):
            liked_playlist_tracks.extend(pl.get("tracks") or [])
    _save_user_liked_tracks(user, liked_playlist_tracks)

    # Extrai os artistas reais mais frequentes nas playlists do usuário para o perfil
    artist_counts: Dict[str, int] = {}
    for pl in merged_playlists:
        for tr in pl.get("tracks") or []:
            first_artist = (tr.get("artist") or "").split(",")[0].strip()
            if first_artist and first_artist.lower() != "artista":
                artist_counts[first_artist] = artist_counts.get(first_artist, 0) + 1

    if artist_counts:
        sorted_artists = [
            a for a, _ in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)
        ]
        existing_artists = [
            a.strip() for a in (user.favorite_artists or "").split(",") if a.strip()
        ]
        merged_artists = list(dict.fromkeys(sorted_artists[:8] + existing_artists))[:12]
        user.favorite_artists = ", ".join(merged_artists)

    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": (
            f"Perfil Spotify de '{display_name}' vinculado com {len(imported_playlists)} playlist(s) real(is)!"
            if imported_playlists
            else f"Perfil Spotify de '{display_name}' vinculado com sucesso!"
        ),
        "imported_playlists_count": len(imported_playlists),
        "spotify_connection": {
            "connected": True,
            "spotify_id": user.spotify_id,
            "display_name": user.spotify_display_name,
            "email": user.spotify_email,
            "avatar_url": user.spotify_avatar_url,
            "profile_url": user.spotify_profile_url,
            "connected_at": user.spotify_connected_at.isoformat(),
        },
    }


@router.post("/import-playlist/{user_id}")
def import_spotify_playlist_by_url(
    user_id: int,
    payload: SpotifyImportPlaylistPayload,
    db: Session = Depends(get_db),
):
    """
    Importa uma Playlist, Álbum, Música ou todas as playlists de um Perfil do Spotify pelo link.
    Se o link for inválido, retorna erro 400 claro pedindo para tentar novamente.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    raw_url = (payload.playlist_url or "").strip()
    parsed = _parse_spotify_url(raw_url)
    if not parsed["type"] or not parsed["id"]:
        raise HTTPException(
            status_code=400,
            detail="Link inválido! Cole um link válido de Playlist (https://open.spotify.com/playlist/...) ou Perfil (https://open.spotify.com/user/...) do Spotify e tente novamente.",
        )

    # Se o usuário colou um link de perfil (/user/...) na barra de importar playlist, importa todas as playlists públicas dele!
    if parsed["type"] == "user":
        try:
            profile_data = _fetch_real_spotify_user_profile(parsed["id"])
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Não foi possível ler o perfil do Spotify informado. Tente novamente. ({str(e)})",
            )

        user_pls = profile_data.get("playlists") or []
        if not user_pls:
            raise HTTPException(
                status_code=400,
                detail=f"O perfil '{profile_data['display_name']}' foi encontrado, mas não possui playlists públicas visíveis no Spotify. Cole o link direto de uma playlist (https://open.spotify.com/playlist/...).",
            )

        saved_playlists = _get_saved_playlists(user)
        new_ids = {p["id"] for p in user_pls}
        saved_playlists = [p for p in saved_playlists if p.get("id") not in new_ids]
        saved_playlists = user_pls + saved_playlists
        _save_user_playlists(user, saved_playlists)

        db.commit()
        db.refresh(user)

        first_pl = user_pls[0]
        user_songs = user.songs or []
        in_studio_count = sum(
            1
            for t in first_pl.get("tracks", [])
            if _match_track_with_user_studio(t["title"], t["artist"], user_songs)
        )
        first_summary = {k: v for k, v in first_pl.items() if k != "tracks"}
        first_summary["in_studio_count"] = in_studio_count
        first_summary["is_custom_imported"] = True

        return {
            "status": "success",
            "message": f"{len(user_pls)} playlists públicas de '{profile_data['display_name']}' foram importadas com sucesso!",
            "playlist": first_summary,
        }

    # Caso padrão: Playlist, Álbum ou Track
    try:
        imported_playlist = _fetch_real_spotify_playlist(raw_url)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao importar playlist do Spotify. Verifique o link e tente novamente. ({str(e)})",
        )

    if not user.spotify_id or not user.spotify_access_token:
        owner_name = imported_playlist.get("owner")
        display_name = (
            owner_name
            if owner_name and owner_name.lower() != "spotify"
            else (user.full_name or user.username or "Conta Spotify")
        )
        user.spotify_id = display_name.lower().replace(" ", "_")
        user.spotify_display_name = display_name
        user.spotify_email = user.email
        user.spotify_avatar_url = (
            user.profile_picture_url or imported_playlist.get("cover") or ""
        )
        user.spotify_profile_url = "https://open.spotify.com"
        user.spotify_access_token = "DIRECT_SPOTIFY_LINK"
        user.spotify_connected_at = datetime.utcnow()

    saved_playlists = _get_saved_playlists(user)
    saved_playlists = [
        p for p in saved_playlists if p.get("id") != imported_playlist["id"]
    ]
    saved_playlists.insert(0, imported_playlist)
    _save_user_playlists(user, saved_playlists)

    # Só adiciona em Músicas Curtidas se a playlist importada for especificamente de Músicas Curtidas
    if _is_liked_songs_playlist_name(imported_playlist.get("name", "")):
        saved_liked = _get_saved_liked_tracks(user)
        existing_ids = {t.get("id") for t in saved_liked}
        for tr in imported_playlist.get("tracks", []):
            if tr.get("id") not in existing_ids:
                saved_liked.append(tr)
                existing_ids.add(tr.get("id"))
        _save_user_liked_tracks(user, saved_liked)

    db.commit()
    db.refresh(user)

    user_songs = user.songs or []
    in_studio_count = sum(
        1
        for t in imported_playlist.get("tracks", [])
        if _match_track_with_user_studio(t["title"], t["artist"], user_songs)
    )

    playlist_summary = {
        k: v for k, v in imported_playlist.items() if k != "tracks"
    }
    playlist_summary["in_studio_count"] = in_studio_count
    playlist_summary["is_custom_imported"] = True

    return {
        "status": "success",
        "message": f"Playlist '{imported_playlist['name']}' ({imported_playlist['tracks_total']} músicas) importada com sucesso!",
        "playlist": playlist_summary,
    }


@router.post("/import-liked/{user_id}")
def import_spotify_liked_tracks_by_url(
    user_id: int,
    payload: SpotifyImportPlaylistPayload,
    db: Session = Depends(get_db),
):
    """
    Importa uma playlist ou música do Spotify diretamente para a aba 'Músicas Curtidas' do usuário,
    garantindo que cada faixa tenha sua capa original.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    raw_url = (payload.playlist_url or "").strip()
    parsed = _parse_spotify_url(raw_url)
    if parsed["type"] not in ("playlist", "album", "track") or not parsed["id"]:
        raise HTTPException(
            status_code=400,
            detail="Cole um link válido de Playlist ou Música do Spotify (https://open.spotify.com/playlist/...) para importar para suas Músicas Curtidas.",
        )

    try:
        imported_data = _fetch_real_spotify_playlist(raw_url, resolve_all_covers=True)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível importar as músicas curtidas: {str(e)}",
        )

    new_tracks = imported_data.get("tracks") or []
    saved_liked = _get_saved_liked_tracks(user)
    existing_ids = {t.get("id") for t in saved_liked}

    added_count = 0
    for tr in new_tracks:
        tid = tr.get("id")
        if tid and tid not in existing_ids:
            saved_liked.append(tr)
            existing_ids.add(tid)
            added_count += 1

    _save_user_liked_tracks(user, saved_liked)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": f"{added_count or len(new_tracks)} música(s) importada(s) para suas Músicas Curtidas com capas originais!",
        "total": len(saved_liked),
    }


@router.post("/liked-tracks/{user_id}/toggle")
def toggle_user_spotify_liked_track(
    user_id: int,
    payload: SpotifyToggleLikedTrackPayload,
    db: Session = Depends(get_db),
):
    """
    Adiciona ou remove uma música específica da aba 'Músicas Curtidas' do usuário.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    saved_liked = _get_saved_liked_tracks(user)
    exists = any(t.get("id") == payload.id for t in saved_liked)

    if exists:
        saved_liked = [t for t in saved_liked if t.get("id") != payload.id]
        is_liked = False
        msg = f"'{payload.title}' removida das suas Músicas Curtidas."
    else:
        cover = payload.cover or ""
        if not _is_valid_original_track_cover(cover):
            cover = _resolve_single_track_cover(payload.id, payload.title, payload.artist)
        saved_liked.insert(
            0,
            {
                "id": payload.id,
                "title": payload.title,
                "artist": payload.artist,
                "album": payload.album or "",
                "duration": payload.duration or 0,
                "cover": cover,
                "preview": payload.preview or "",
                "suggested_genre": "Rock",
                "original_key": "Unknown",
                "external_url": payload.external_url
                or f"https://open.spotify.com/track/{payload.id}",
            },
        )
        is_liked = True
        msg = f"'{payload.title}' adicionada às suas Músicas Curtidas!"

    _save_user_liked_tracks(user, saved_liked)
    db.commit()

    return {
        "status": "success",
        "is_liked": is_liked,
        "message": msg,
        "total": len(saved_liked),
    }


@router.delete("/playlists/{user_id}/{playlist_id}")
def delete_imported_spotify_playlist(
    user_id: int, playlist_id: str, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    saved_playlists = _get_saved_playlists(user)
    updated = [p for p in saved_playlists if p.get("id") != playlist_id]
    _save_user_playlists(user, updated)
    db.commit()

    return {"status": "success", "message": "Playlist removida do seu perfil."}


@router.post("/disconnect/{user_id}")
def disconnect_spotify(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    user.spotify_id = None
    user.spotify_display_name = None
    user.spotify_email = None
    user.spotify_avatar_url = None
    user.spotify_profile_url = None
    user.spotify_access_token = None
    user.spotify_refresh_token = None
    user.spotify_token_expires_at = None
    user.spotify_connected_at = None
    user.spotify_playlists_json = None
    user.spotify_liked_tracks_json = None

    db.commit()
    return {
        "status": "success",
        "message": "Conta do Spotify e playlists desvinculadas com sucesso.",
    }


@router.get("/playlists/{user_id}")
def get_user_spotify_playlists(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    token = _get_valid_access_token(user, db)
    user_songs = user.songs or []

    # 1. Playlists reais importadas e salvas no banco do usuário
    saved_custom = _get_saved_playlists(user)

    # Se o usuário tinha vinculado um link de perfil (/user/...) antes desta atualização e ainda está sem playlists salvas,
    # busca automaticamente as playlists reais do perfil dele agora!
    if not saved_custom and user.spotify_profile_url:
        parsed_prof = _parse_spotify_url(user.spotify_profile_url)
        if parsed_prof["type"] == "user" and parsed_prof["id"]:
            try:
                prof_data = _fetch_real_spotify_user_profile(parsed_prof["id"])
                if prof_data.get("display_name"):
                    user.spotify_display_name = prof_data["display_name"]
                if prof_data.get("avatar_url"):
                    user.spotify_avatar_url = prof_data["avatar_url"]
                saved_custom = prof_data.get("playlists") or []
                if saved_custom:
                    _save_user_playlists(user, saved_custom)
                db.commit()
            except Exception as e:
                print(f"[Auto-Sync Spotify Profile Warning]: {e}")

    enriched_custom = []
    for pl in saved_custom:
        pl_tracks = pl.get("tracks") or []
        in_studio_count = sum(
            1
            for t in pl_tracks
            if _match_track_with_user_studio(
                t.get("title", ""), t.get("artist", ""), user_songs
            )
        )
        summary = {k: v for k, v in pl.items() if k != "tracks"}
        summary["tracks_total"] = len(pl_tracks) or pl.get("tracks_total", 0)
        summary["in_studio_count"] = in_studio_count
        summary["is_custom_imported"] = True
        enriched_custom.append(summary)

    # 2. Modo Conexão Direta (retorna EXCLUSIVAMENTE as playlists reais do usuário!)
    if token in ("DIRECT_SPOTIFY_LINK", "DEMO_TOKEN"):
        return {
            "status": "success",
            "is_demo": False,
            "total": len(enriched_custom),
            "playlists": enriched_custom,
        }

    # 3. Modo Oficial Spotify Web API (OAuth Token) + Playlists Importadas por Link
    try:
        resp = requests.get(
            f"{SPOTIFY_API_BASE}/me/playlists",
            params={"limit": 30},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        playlists = list(enriched_custom)
        existing_ids = {p["id"] for p in playlists}

        for item in data.get("items") or []:
            if not item or item.get("id") in existing_ids:
                continue
            images = item.get("images") or []
            cover = images[0].get("url") if images else ""
            owner_info = item.get("owner") or {}
            tracks_info = item.get("tracks") or {}

            playlists.append({
                "id": item.get("id"),
                "name": item.get("name", "Playlist sem nome"),
                "description": item.get("description") or "",
                "cover": cover,
                "tracks_total": tracks_info.get("total", 0),
                "owner": (
                    owner_info.get("display_name")
                    or owner_info.get("id")
                    or "Spotify"
                ),
                "public": bool(item.get("public", True)),
                "external_url": (item.get("external_urls") or {}).get("spotify", ""),
                "in_studio_count": 0,
            })

        return {
            "status": "success",
            "is_demo": False,
            "total": len(playlists),
            "playlists": playlists,
        }

    except requests.RequestException as e:
        if enriched_custom:
            return {
                "status": "success",
                "is_demo": False,
                "total": len(enriched_custom),
                "playlists": enriched_custom,
            }
        raise HTTPException(
            status_code=502,
            detail=f"Não foi possível carregar as playlists do Spotify: {str(e)}",
        )


@router.get("/playlists/{user_id}/{playlist_id}/tracks")
def get_spotify_playlist_tracks(
    user_id: int, playlist_id: str, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    token = _get_valid_access_token(user, db)
    user_songs = user.songs or []
    liked_ids_set = {t.get("id") for t in _get_saved_liked_tracks(user) if t.get("id")}

    # 1. Verifica nas playlists reais salvas do usuário
    saved_custom = _get_saved_playlists(user)
    for custom_pl in saved_custom:
        if custom_pl.get("id") == playlist_id:
            raw_tracks = custom_pl.get("tracks") or []
            # Garante que TODAS as faixas tenham a capa original da música (e nunca a capa da playlist!)
            if _ensure_tracks_have_original_covers(
                raw_tracks, custom_pl.get("cover") or ""
            ):
                _save_user_playlists(user, saved_custom)
                db.commit()

            tracks = []
            for t in raw_tracks:
                studio_match = _match_track_with_user_studio(
                    t.get("title", ""), t.get("artist", ""), user_songs
                )
                tracks.append({
                    **t,
                    "is_liked": t.get("id") in liked_ids_set,
                    "in_studio": bool(studio_match),
                    "studio_song": studio_match,
                })
            in_studio_count = sum(1 for t in tracks if t["in_studio"])
            return {
                "status": "success",
                "playlist_id": playlist_id,
                "total": len(tracks),
                "in_studio_count": in_studio_count,
                "tracks": tracks,
            }

    # 2. Caso não esteja em cache mas seja um ID válido do Spotify, busca em tempo real via Embed
    if token in ("DIRECT_SPOTIFY_LINK", "DEMO_TOKEN"):
        try:
            live_pl = _fetch_real_spotify_playlist(
                playlist_id, entity_type_override="playlist", resolve_all_covers=True
            )
            tracks = []
            for t in live_pl.get("tracks") or []:
                studio_match = _match_track_with_user_studio(
                    t.get("title", ""), t.get("artist", ""), user_songs
                )
                tracks.append({
                    **t,
                    "is_liked": t.get("id") in liked_ids_set,
                    "in_studio": bool(studio_match),
                    "studio_song": studio_match,
                })
            in_studio_count = sum(1 for t in tracks if t["in_studio"])
            return {
                "status": "success",
                "playlist_id": playlist_id,
                "total": len(tracks),
                "in_studio_count": in_studio_count,
                "tracks": tracks,
            }
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"Playlist não encontrada: {str(e)}",
            )

    # 3. Modo Oficial Spotify Web API
    try:
        resp = requests.get(
            f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks",
            params={"limit": 50},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        tracks = []
        for item in data.get("items") or []:
            track_obj = (item or {}).get("track")
            if not track_obj or not track_obj.get("id"):
                continue

            artists = track_obj.get("artists") or []
            artist_name = (
                ", ".join(a.get("name", "") for a in artists if a.get("name"))
                or "Artista Desconhecido"
            )
            album_obj = track_obj.get("album") or {}
            images = album_obj.get("images") or []
            cover = images[0].get("url") if images else ""
            duration_sec = int((track_obj.get("duration_ms") or 0) / 1000)
            title = track_obj.get("name", "Sem título")

            studio_match = _match_track_with_user_studio(title, artist_name, user_songs)

            tracks.append({
                "id": track_obj.get("id"),
                "title": title,
                "artist": artist_name,
                "album": album_obj.get("name", ""),
                "duration": duration_sec,
                "cover": cover,
                "preview": track_obj.get("preview_url") or "",
                "suggested_genre": "Rock",
                "original_key": "Unknown",
                "external_url": (track_obj.get("external_urls") or {}).get(
                    "spotify", ""
                ),
                "is_liked": track_obj.get("id") in liked_ids_set,
                "in_studio": bool(studio_match),
                "studio_song": studio_match,
            })

        in_studio_count = sum(1 for t in tracks if t["in_studio"])
        return {
            "status": "success",
            "playlist_id": playlist_id,
            "total": len(tracks),
            "in_studio_count": in_studio_count,
            "tracks": tracks,
        }

    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao buscar faixas da playlist no Spotify: {str(e)}",
        )


@router.get("/liked-tracks/{user_id}")
def get_user_spotify_liked_tracks(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    token = _get_valid_access_token(user, db)
    user_songs = user.songs or []

    saved_liked = _get_saved_liked_tracks(user)
    saved_pls = _get_saved_playlists(user)

    # Sanitização automática: se saved_liked havia sido preenchida acidentalmente com cópia da 1ª playlist
    # (ou se todas as músicas em saved_liked tinham capa de playlist 'ab67706c'), limpa a cópia indevida!
    if saved_liked and saved_pls:
        first_pl_ids = [t.get("id") for t in (saved_pls[0].get("tracks") or [])[:len(saved_liked)]]
        liked_ids = [t.get("id") for t in saved_liked]
        has_playlist_mosaic_cover = any("ab67706c" in (t.get("cover") or "") for t in saved_liked)
        if (
            not _is_liked_songs_playlist_name(saved_pls[0].get("name", ""))
            and (liked_ids == first_pl_ids or has_playlist_mosaic_cover)
        ):
            saved_liked = []
            _save_user_liked_tracks(user, [])
            db.commit()

    if token in ("DIRECT_SPOTIFY_LINK", "DEMO_TOKEN"):
        if saved_liked and _ensure_tracks_have_original_covers(saved_liked):
            _save_user_liked_tracks(user, saved_liked)
            db.commit()

        tracks = []
        for t in saved_liked:
            studio_match = _match_track_with_user_studio(
                t.get("title", ""), t.get("artist", ""), user_songs
            )
            tracks.append({
                **t,
                "is_liked": True,
                "preview": t.get("preview", ""),
                "in_studio": bool(studio_match),
                "studio_song": studio_match,
            })
        in_studio_count = sum(1 for t in tracks if t["in_studio"])
        return {
            "status": "success",
            "is_direct_link": True,
            "total": len(tracks),
            "in_studio_count": in_studio_count,
            "tracks": tracks,
        }

    try:
        resp = requests.get(
            f"{SPOTIFY_API_BASE}/me/tracks",
            params={"limit": 40},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        tracks = []
        for item in data.get("items") or []:
            track_obj = (item or {}).get("track")
            if not track_obj or not track_obj.get("id"):
                continue

            artists = track_obj.get("artists") or []
            artist_name = (
                ", ".join(a.get("name", "") for a in artists if a.get("name"))
                or "Artista Desconhecido"
            )
            album_obj = track_obj.get("album") or {}
            images = album_obj.get("images") or []
            cover = images[0].get("url") if images else ""
            duration_sec = int((track_obj.get("duration_ms") or 0) / 1000)
            title = track_obj.get("name", "Sem título")

            studio_match = _match_track_with_user_studio(title, artist_name, user_songs)

            tracks.append({
                "id": track_obj.get("id"),
                "title": title,
                "artist": artist_name,
                "album": album_obj.get("name", ""),
                "duration": duration_sec,
                "cover": cover,
                "preview": track_obj.get("preview_url") or "",
                "suggested_genre": "Rock",
                "original_key": "Unknown",
                "external_url": (track_obj.get("external_urls") or {}).get(
                    "spotify", ""
                ),
                "in_studio": bool(studio_match),
                "studio_song": studio_match,
            })

        in_studio_count = sum(1 for t in tracks if t["in_studio"])
        return {
            "status": "success",
            "total": len(tracks),
            "in_studio_count": in_studio_count,
            "tracks": tracks,
        }

    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao buscar músicas curtidas no Spotify: {str(e)}",
        )


@router.post("/sync-taste/{user_id}")
def sync_spotify_musical_taste(user_id: int, db: Session = Depends(get_db)):
    """
    Sincroniza automaticamente os Top Artistas reais a partir das playlists do usuário no Spotify.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    token = _get_valid_access_token(user, db)
    saved_custom = _get_saved_playlists(user)

    if token in ("DIRECT_SPOTIFY_LINK", "DEMO_TOKEN"):
        artist_counts: Dict[str, int] = {}
        for pl in saved_custom:
            for tr in pl.get("tracks") or []:
                art = (tr.get("artist") or "").split(",")[0].strip()
                if art and art.lower() != "artista":
                    artist_counts[art] = artist_counts.get(art, 0) + 1

        if not artist_counts:
            raise HTTPException(
                status_code=400,
                detail="Importe pelo menos uma playlist pública do seu Spotify para sincronizar seus artistas favoritos!",
            )

        top_artists = [
            a for a, _ in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)
        ][:10]
        mapped_genres = ["Rock", "Pop", "MPB", "Indie"]
    else:
        try:
            resp = requests.get(
                f"{SPOTIFY_API_BASE}/me/top/artists",
                params={"limit": 8, "time_range": "medium_term"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get("items") or []

            top_artists = [a.get("name") for a in items if a.get("name")]
            raw_genres = []
            for a in items:
                raw_genres.extend(a.get("genres") or [])

            mapped_set = []
            for rg in raw_genres:
                g = map_deezer_genre([rg])
                if g and g not in mapped_set:
                    mapped_set.append(g)
            mapped_genres = mapped_set[:6] if mapped_set else ["Rock", "Pop"]
        except Exception as e:
            print(f"[Spotify Top Taste Warning]: {e}")
            raise HTTPException(
                status_code=502,
                detail="Não foi possível obter os Top Artistas do Spotify.",
            )

    existing_artists = [
        a.strip() for a in (user.favorite_artists or "").split(",") if a.strip()
    ]
    merged_artists = list(dict.fromkeys(top_artists + existing_artists))[:12]

    existing_genres = [
        g.strip() for g in (user.favorite_genres or "").split(",") if g.strip()
    ]
    merged_genres = list(dict.fromkeys(mapped_genres + existing_genres))[:8]

    user.favorite_artists = ", ".join(merged_artists)
    user.favorite_genres = ", ".join(merged_genres)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": f"DNA Musical atualizado com os artistas das suas playlists ({', '.join(top_artists[:4])}...)!",
        "favorite_artists": user.favorite_artists,
        "favorite_genres": user.favorite_genres,
        "imported_artists": top_artists,
        "imported_genres": mapped_genres,
    }
