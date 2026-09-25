import urllib.parse
import requests
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/music", tags=["Music Catalog & Lyrics"])

DEEZER_SEARCH_URL = "https://api.deezer.com/search"
LRCLIB_GET_URL = "https://lrclib.net/api/get"
LRCLIB_SEARCH_URL = "https://lrclib.net/api/search"

REQUEST_HEADERS = {
    "User-Agent": "EasyCovers/1.0 (https://easycovers.app; contact@easycovers.app)"
}

@router.get("/search")
def search_catalog(
    q: str = Query(..., min_length=1, description="Termo de busca (música ou artista)"),
    limit: int = Query(15, ge=1, le=50, description="Quantidade máxima de resultados")
):
    """
    Busca faixas musicais no catálogo global da Deezer com capas HD e previews de 30 segundos.
    """
    try:
        response = requests.get(
            DEEZER_SEARCH_URL,
            params={"q": q, "limit": limit},
            headers=REQUEST_HEADERS,
            timeout=8
        )
        response.raise_for_status()
        data = response.json()

        results = []
        raw_items = data.get("data", [])

        for item in raw_items:
            album_info = item.get("album", {})
            artist_info = item.get("artist", {})
            
            # Prioriza a maior resolução disponível para o álbum
            best_cover = (
                album_info.get("cover_xl") or 
                album_info.get("cover_big") or 
                album_info.get("cover_medium") or 
                album_info.get("cover")
            )

            results.append({
                "id": str(item.get("id")),
                "title": item.get("title", "Desconhecido"),
                "title_short": item.get("title_short", item.get("title")),
                "artist": artist_info.get("name", "Artista Desconhecido"),
                "artist_id": artist_info.get("id"),
                "artist_picture": artist_info.get("picture_medium"),
                "album": album_info.get("title", ""),
                "album_id": album_info.get("id"),
                "duration": item.get("duration", 0),
                "isrc": item.get("isrc"),
                "preview": item.get("preview"), # URL do streaming de 30s MP3
                "cover_xl": album_info.get("cover_xl"),
                "cover_big": album_info.get("cover_big"),
                "cover_medium": album_info.get("cover_medium"),
                "cover_small": album_info.get("cover_small"),
                "cover": best_cover,
                "link": item.get("link")
            })

        return {
            "status": "success",
            "total": len(results),
            "results": results
        }

    except requests.RequestException as e:
        print(f"[Music Search Error] Falha na busca Deezer: {e}")
        raise HTTPException(
            status_code=502, 
            detail=f"Não foi possível consultar o catálogo de música externo: {str(e)}"
        )


def map_deezer_genre(raw_genres: list[str]) -> str:
    """
    Mapeia os nomes de gêneros retornados pela API da Deezer para a lista padronizada do EasyCovers.
    """
    for g in raw_genres:
        norm = g.strip().lower()
        if any(k in norm for k in ["grunge"]):
            return "Grunge"
        if any(k in norm for k in ["metal", "hard rock"]):
            return "Heavy Metal"
        if any(k in norm for k in ["indie", "alternativ"]):
            return "Indie Rock"
        if any(k in norm for k in ["prog"]):
            return "Rock Progressivo"
        if any(k in norm for k in ["blues"]):
            return "Blues Rock"
        if any(k in norm for k in ["rock"]):
            return "Rock"
        if any(k in norm for k in ["bossa"]):
            return "Bossa Nova"
        if any(k in norm for k in ["mpb"]):
            return "MPB"
        if any(k in norm for k in ["samba", "pagode"]):
            return "Samba"
        if any(k in norm for k in ["sertanejo", "forró", "forro", "country", "folk"]):
            return "Sertanejo"
        if any(k in norm for k in ["clássic", "classic", "orquestra", "opera", "instrumental"]):
            return "Música Clássica"
        if any(k in norm for k in ["eletrônic", "eletronic", "electro", "dance", "house", "techno", "edm"]):
            return "Eletrônica"
        if any(k in norm for k in ["jazz"]):
            return "Jazz"
        if any(k in norm for k in ["r&b", "soul", "funk", "disco"]):
            return "R&B / Soul"
        if any(k in norm for k in ["rap", "hip hop", "hip-hop", "trap"]):
            return "Hip-Hop / Rap"
        if any(k in norm for k in ["reggae"]):
            return "Reggae"
        if any(k in norm for k in ["pop", "brasil"]):
            return "Pop"
    return "Rock"


@router.get("/track/{track_id}")
def get_track_details(track_id: str):
    """
    Busca detalhes completos da faixa na Deezer, renovando a URL de preview e identificando o gênero oficial do álbum.
    """
    try:
        track_resp = requests.get(
            f"https://api.deezer.com/track/{track_id}",
            headers=REQUEST_HEADERS,
            timeout=8
        )
        track_resp.raise_for_status()
        track_data = track_resp.json()

        if "error" in track_data:
            raise HTTPException(status_code=404, detail="Faixa não encontrada na Deezer.")

        album_info = track_data.get("album", {})
        artist_info = track_data.get("artist", {})
        album_id = album_info.get("id")

        raw_genre_names = []
        if album_id:
            try:
                album_resp = requests.get(
                    f"https://api.deezer.com/album/{album_id}",
                    headers=REQUEST_HEADERS,
                    timeout=6
                )
                if album_resp.status_code == 200:
                    album_data = album_resp.json()
                    genres_list = album_data.get("genres", {}).get("data", [])
                    raw_genre_names = [g.get("name", "") for g in genres_list if g.get("name")]
            except requests.RequestException:
                pass

        mapped_genre = map_deezer_genre(raw_genre_names) if raw_genre_names else ""
        best_cover = (
            album_info.get("cover_xl") or
            album_info.get("cover_big") or
            album_info.get("cover_medium") or
            album_info.get("cover")
        )

        return {
            "status": "success",
            "id": str(track_data.get("id", track_id)),
            "title": track_data.get("title", ""),
            "artist": artist_info.get("name", ""),
            "album": album_info.get("title", ""),
            "duration": track_data.get("duration", 0),
            "bpm": track_data.get("bpm", 0),
            "isrc": track_data.get("isrc", ""),
            "preview": track_data.get("preview", ""),
            "cover": best_cover,
            "raw_genres": raw_genre_names,
            "suggested_genre": mapped_genre
        }

    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Erro ao obter detalhes da faixa na Deezer: {str(e)}")


@router.get("/lyrics")
def get_lyrics(
    track_name: str = Query(..., description="Nome da música"),
    artist_name: str = Query(..., description="Nome do artista"),
    duration: Optional[float] = Query(None, description="Duração em segundos para melhor correspondência")
):
    """
    Busca letras sincronizadas (timestamps no formato [mm:ss.xx]) e texto puro via LRCLIB.
    """
    params = {
        "track_name": track_name.strip(),
        "artist_name": artist_name.strip()
    }
    if duration is not None and isinstance(duration, (int, float, str)):
        try:
            params["duration"] = int(float(duration))
        except (ValueError, TypeError):
            pass

    try:
        # 1. Tentativa de correspondência exata
        response = requests.get(
            LRCLIB_GET_URL,
            params=params,
            headers=REQUEST_HEADERS,
            timeout=8
        )

        if response.status_code == 200:
            data = response.json()
            return {
                "status": "success",
                "instrumental": data.get("instrumental", False),
                "plain_lyrics": data.get("plainLyrics", ""),
                "synced_lyrics": data.get("syncedLyrics", ""),
                "has_synced": bool(data.get("syncedLyrics"))
            }

        # 2. Se não encontrar exato, tenta busca ampla (search)
        search_query = f"{track_name} {artist_name}"
        search_resp = requests.get(
            LRCLIB_SEARCH_URL,
            params={"q": search_query},
            headers=REQUEST_HEADERS,
            timeout=8
        )

        if search_resp.status_code == 200:
            search_items = search_resp.json()
            if isinstance(search_items, list) and len(search_items) > 0:
                # Prioriza um item que possua syncedLyrics
                best_item = next((it for it in search_items if it.get("syncedLyrics")), search_items[0])
                return {
                    "status": "success",
                    "instrumental": best_item.get("instrumental", False),
                    "plain_lyrics": best_item.get("plainLyrics", ""),
                    "synced_lyrics": best_item.get("syncedLyrics", ""),
                    "has_synced": bool(best_item.get("syncedLyrics"))
                }

        return {
            "status": "not_found",
            "message": "Nenhuma letra encontrada para esta música.",
            "synced_lyrics": "",
            "plain_lyrics": "",
            "has_synced": False
        }

    except requests.RequestException as e:
        print(f"[LRCLIB Lyrics Error]: {e}")
        return {
            "status": "error",
            "message": f"Erro de comunicação com serviço de letras: {str(e)}",
            "synced_lyrics": "",
            "plain_lyrics": "",
            "has_synced": False
        }
