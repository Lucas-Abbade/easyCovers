import os
import re
import shutil
import uuid
import glob
import requests
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from yt_dlp import YoutubeDL
from ..database import get_db
from ..models import Song
from ..services.audio_service import process_demucs, normalize_audio
from .spotify import _resolve_single_track_cover

router = APIRouter(tags=["Upload"])

# Pasta temporária para downloads
DOWNLOAD_DIR = "temp_downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

@router.post("/processar-audio/")
def process_audio(
    name: str, 
    artist: str, 
    genre: str, 
    instrument: str,
    user_id: int,
    original_key: str = "Unknown",
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    musica_id = str(uuid.uuid4())[:8]
    storage_base = "storage/stems"
    musica_folder = os.path.join(storage_base, musica_id)
    os.makedirs(musica_folder, exist_ok=True)
    
    temp_path = f"temp_{musica_id}_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    normalized_path = f"temp_{musica_id}_normalized.wav"

    try:
        print(f"Processando: {name} - ID: {musica_id}")
        
        # Normaliza o áudio usando loudnorm para WAV a 44100Hz estéreo (lossless e rápido)
        normalize_audio(temp_path, normalized_path)
        
        # Chama a função de Inteligência Artificial com o arquivo normalizado
        process_demucs(normalized_path, musica_folder)

        # Inserção manual: cover_image_url permanece None para exibir a imagem do estilo musical (gênero)
        nova_musica = Song(
            name=name,
            artist=artist,
            genre=genre,
            original_key=original_key,
            instrument=instrument,
            folder_path=musica_folder,
            cover_image_url=None,
            user_id=user_id 
        )
        db.add(nova_musica)
        db.commit()
        db.refresh(nova_musica)

        return {
            "status": "sucesso", 
            "id": nova_musica.id, 
            "folder": musica_folder, 
            "folder_path": musica_folder, 
            "original_key": original_key,
            "cover_image_url": None
        }

    except Exception as e:
        print(f"Erro no processamento: {e}")
        if os.path.exists(musica_folder):
            shutil.rmtree(musica_folder, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Erro no processamento: {str(e)}")
    
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        if os.path.exists(normalized_path):
            try:
                os.remove(normalized_path)
            except Exception:
                pass


@router.post("/upload-youtube/")
async def upload_from_youtube(data: dict, db: Session = Depends(get_db)):
    url = data.get("url")
    user_id = data.get("user_id")
    
    if not url:
        raise HTTPException(status_code=400, detail="URL do YouTube é necessária")

    custom_title = data.get('custom_title')
    custom_artist = data.get('custom_artist')
    custom_genre = data.get('custom_genre')
    custom_instrument = data.get('custom_instrument')
    custom_original_key = data.get('custom_original_key')

    musica_folder = None
    downloaded_file = None
    normalized_path = None

    try:
        file_id = str(uuid.uuid4())
        musica_id = str(uuid.uuid4())[:8]
        storage_base = "storage/stems"
        musica_folder = os.path.join(storage_base, musica_id)
        os.makedirs(musica_folder, exist_ok=True)

        cpu_count = os.cpu_count() or 1
        ffmpeg_threads = max(1, cpu_count - 1)
        
        ydl_opts = _build_ydl_options(file_id, ffmpeg_threads)

        # Download do áudio do YouTube
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            song_title = info.get('title', 'Musica do YouTube')
            if 'requested_downloads' in info and info['requested_downloads']:
                downloaded_file = info['requested_downloads'][0].get('filepath')
            if not downloaded_file or not os.path.exists(downloaded_file):
                downloaded_file = ydl.prepare_filename(info)

        # Fallback caso o nome divirja do esperado
        if not downloaded_file or not os.path.exists(downloaded_file):
            matches = glob.glob(os.path.join(DOWNLOAD_DIR, f"{file_id}.*"))
            if matches:
                downloaded_file = matches[0]

        if not downloaded_file or not os.path.exists(downloaded_file):
            raise Exception("Não foi possível localizar o arquivo de áudio baixado do YouTube.")

        # Normaliza o áudio diretamente para WAV (44100Hz, estéreo)
        normalized_path = os.path.join(musica_folder, f"{file_id}_normalized.wav")
        normalize_audio(downloaded_file, normalized_path)

        # Remove o arquivo bruto baixado
        if os.path.exists(downloaded_file):
            try:
                os.remove(downloaded_file)
            except Exception:
                pass
            downloaded_file = None

        # Processamento das 6 faixas com Demucs
        process_demucs(normalized_path, musica_folder)

        # Inserção manual: cover_image_url permanece None para exibir a imagem do estilo musical (gênero)
        nova_musica = Song(
            name=custom_title or song_title,
            artist=custom_artist or "YouTube",
            genre=custom_genre or "Unknown",
            original_key=custom_original_key or "Unknown",
            instrument=custom_instrument or "Unknown",
            folder_path=musica_folder,
            cover_image_url=None,
            user_id=user_id
        )
        db.add(nova_musica)
        db.commit()
        db.refresh(nova_musica)

        return nova_musica

    except Exception as e:
        print(f"Erro no YouTube: {e}")
        if musica_folder and os.path.exists(musica_folder):
            stem_files = [f for f in os.listdir(musica_folder) if f.endswith('.wav') and not f.endswith('_normalized.wav')]
            if len(stem_files) < 6:
                shutil.rmtree(musica_folder, ignore_errors=True)
        clean_msg = re.sub(r'\x1b\[[0-9;]*m', '', str(e))
        raise HTTPException(status_code=500, detail=f"Erro ao processar áudio do YouTube: {clean_msg}")
    
    finally:
        # Limpeza de arquivos temporários
        if downloaded_file and os.path.exists(downloaded_file):
            try:
                os.remove(downloaded_file)
            except Exception:
                pass
        if normalized_path and os.path.exists(normalized_path):
            try:
                os.remove(normalized_path)
            except Exception:
                pass


def _build_ydl_options(file_id: str, ffmpeg_threads: int) -> dict:
    """
    Configurações robustas para o yt-dlp:
    - http_chunk_size: evita que a CDN do YouTube (googlevideo) feche a conexão por timeout
      ou 'Remote end closed connection without response'.
    - extractor_args: usa player_client android e web para contornar restrições anti-bot/SABR.
    - source_address: força IPv4 (0.0.0.0), contornando falhas de rota IPv6 no Windows.
    - retries / fragment_retries / socket_timeout: tolerância a instabilidades transitórias.
    """
    return {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        'noplaylist': True,
        'extract_flat': False,
        'outtmpl': os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s"),
        'postprocessor_args': ['-threads', str(ffmpeg_threads)],
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '0',
        }],
        # Segmenta o fluxo em chunks de 10MB para prevenir 'Remote end closed connection'
        'http_chunk_size': 10485760,
        # Clientes móveis e web da YouTube API
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],
                'player_skip': ['webpage', 'configs']
            }
        },
        # Força IPv4 no Windows para rotas mais estáveis
        'source_address': '0.0.0.0',
        # Retentativas automáticas
        'retries': 10,
        'fragment_retries': 10,
        'file_access_retries': 5,
        'socket_timeout': 30,
        'retry_sleep_functions': {'http': lambda n: min(2 ** n, 10)},
        # Ignora verificação estrita de SSL em caso de proxy/antivírus de rede local
        'nocheckcertificate': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        'quiet': True,
        'no_warnings': True,
    }


def _download_full_track_auto_match(artist: str, title: str, expected_duration: int, file_id: str) -> str:
    """
    Localiza e baixa automaticamente a faixa completa em alta qualidade usando os metadados e duração oficial da Deezer.
    Possui fallback automático entre múltiplos candidatos caso o primeiro sofra restrição ou queda de conexão.
    """
    cpu_count = os.cpu_count() or 1
    ffmpeg_threads = max(1, cpu_count - 1)

    search_query = f"ytsearch6:{artist} - {title} official audio"
    search_opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'extract_flat': True,
        'source_address': '0.0.0.0',
        'socket_timeout': 20,
        'nocheckcertificate': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web']
            }
        }
    }

    target_urls = []
    try:
        with YoutubeDL(search_opts) as ydl_search:
            search_info = ydl_search.extract_info(search_query, download=False)
            entries = [e for e in (search_info.get('entries') or []) if e]

            if entries:
                if expected_duration and expected_duration > 30:
                    # Filtra vídeos muito longos (ex: shows completos) e ordena pela proximidade da duração oficial
                    valid_entries = [
                        e for e in entries
                        if not e.get('duration') or (30 <= e.get('duration', 0) <= max(expected_duration * 2, 900))
                    ]
                    candidates = valid_entries if valid_entries else entries
                    candidates.sort(
                        key=lambda e: abs((e.get('duration') or expected_duration) - expected_duration)
                    )
                else:
                    candidates = entries

                for item in candidates[:4]:
                    url = item.get('url') or item.get('webpage_url') or (f"https://www.youtube.com/watch?v={item['id']}" if item.get('id') else None)
                    if url and url not in target_urls:
                        target_urls.append(url)
    except Exception as search_err:
        print(f"[Auto-Match Search Warning] {search_err}")

    # Fallbacks adicionais de busca caso a busca inicial retorne vazia
    if not target_urls:
        target_urls = [
            f"ytsearch1:{artist} - {title} audio",
            f"ytsearch1:{artist} - {title}"
        ]

    ydl_opts = _build_ydl_options(file_id, ffmpeg_threads)

    downloaded_file = None
    last_error = None

    for target_url in target_urls:
        try:
            print(f"[Auto-Match] Tentando obter áudio de: {target_url}")
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(target_url, download=True)
                if 'entries' in info and info['entries']:
                    info = info['entries'][0]
                if 'requested_downloads' in info and info['requested_downloads']:
                    downloaded_file = info['requested_downloads'][0].get('filepath')
                if not downloaded_file or not os.path.exists(downloaded_file):
                    downloaded_file = ydl.prepare_filename(info)

            if not downloaded_file or not os.path.exists(downloaded_file):
                matches = glob.glob(os.path.join(DOWNLOAD_DIR, f"{file_id}.*"))
                if matches:
                    downloaded_file = matches[0]

            if downloaded_file and os.path.exists(downloaded_file) and os.path.getsize(downloaded_file) > 1024:
                print(f"[Auto-Match] Áudio baixado com sucesso: {downloaded_file}")
                return downloaded_file

        except Exception as err:
            last_error = err
            print(f"[Auto-Match Warning] Falha ao baixar candidato ({target_url}): {err}")
            # Limpa parciais para não corromper a próxima tentativa
            for partial in glob.glob(os.path.join(DOWNLOAD_DIR, f"{file_id}.*")):
                try:
                    os.remove(partial)
                except Exception:
                    pass
            continue

    if not downloaded_file or not os.path.exists(downloaded_file):
        clean_err = re.sub(r'\x1b\[[0-9;]*m', '', str(last_error or ''))
        raise Exception(f"Não foi possível obter o áudio completo da música. Detalhes: {clean_err}")

    return downloaded_file


@router.post("/upload-catalog/")
async def upload_from_catalog(data: dict, db: Session = Depends(get_db)):
    """
    Endpoint principal: Recebe a música selecionada na busca da Deezer, captura a faixa completa
    automaticamente e separa as 6 faixas com IA.
    """
    title = (data.get("title") or "").strip()
    artist = (data.get("artist") or "").strip()
    user_id = data.get("user_id")

    if not title or not artist:
        raise HTTPException(status_code=400, detail="Título e artista da música são obrigatórios.")

    expected_duration = int(data.get("duration") or 0)
    deezer_track_id = str(data.get("deezer_track_id") or "")

    genre = data.get("genre") or "Rock"
    instrument = data.get("instrument") or "Guitarra"
    original_key = data.get("original_key") or "Unknown"
    cover_image_url = data.get("cover_image_url")

    # Garante que músicas vindas da API preservem a capa oficial do álbum (Spotify oEmbed ou Deezer)
    if not cover_image_url and deezer_track_id:
        if re.match(r"^[A-Za-z0-9]{22}$", deezer_track_id):
            cover_image_url = _resolve_single_track_cover(deezer_track_id, title, artist) or None
        elif deezer_track_id.isdigit():
            try:
                track_resp = requests.get(f"https://api.deezer.com/track/{deezer_track_id}", timeout=6)
                if track_resp.status_code == 200:
                    album_info = track_resp.json().get("album", {})
                    cover_image_url = (
                        album_info.get("cover_xl") or
                        album_info.get("cover_big") or
                        album_info.get("cover_medium") or
                        album_info.get("cover")
                    )
            except Exception:
                pass

    musica_folder = None
    downloaded_file = None
    normalized_path = None

    try:
        file_id = str(uuid.uuid4())
        musica_id = str(uuid.uuid4())[:8]
        storage_base = "storage/stems"
        musica_folder = os.path.join(storage_base, musica_id)
        os.makedirs(musica_folder, exist_ok=True)

        print(f"[Catálogo Deezer] Capturando faixa completa: {artist} - {title} ({expected_duration}s)")
        downloaded_file = _download_full_track_auto_match(artist, title, expected_duration, file_id)

        # Normaliza o áudio diretamente para WAV (44100Hz, estéreo)
        normalized_path = os.path.join(musica_folder, f"{file_id}_normalized.wav")
        normalize_audio(downloaded_file, normalized_path)

        if os.path.exists(downloaded_file):
            try:
                os.remove(downloaded_file)
            except Exception:
                pass
            downloaded_file = None

        # Processamento das 6 faixas com Demucs
        process_demucs(normalized_path, musica_folder)

        # Salva no Banco de Dados
        nova_musica = Song(
            name=title,
            artist=artist,
            genre=genre,
            original_key=original_key,
            instrument=instrument,
            folder_path=musica_folder,
            cover_image_url=cover_image_url,
            user_id=user_id
        )
        db.add(nova_musica)
        db.commit()
        db.refresh(nova_musica)

        return nova_musica

    except Exception as e:
        print(f"Erro no processamento do catálogo: {e}")
        if musica_folder and os.path.exists(musica_folder):
            stem_files = [f for f in os.listdir(musica_folder) if f.endswith('.wav') and not f.endswith('_normalized.wav')]
            if len(stem_files) < 6:
                shutil.rmtree(musica_folder, ignore_errors=True)
        clean_err = re.sub(r'\x1b\[[0-9;]*m', '', str(e))
        raise HTTPException(status_code=500, detail=f"Erro ao obter e separar o áudio do catálogo: {clean_err}")

    finally:
        if downloaded_file and os.path.exists(downloaded_file):
            try:
                os.remove(downloaded_file)
            except Exception:
                pass
        if normalized_path and os.path.exists(normalized_path):
            try:
                os.remove(normalized_path)
            except Exception:
                pass