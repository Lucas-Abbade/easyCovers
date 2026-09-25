import os
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
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'extract_flat': False,
            'outtmpl': os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s"),
            'postprocessor_args': ['-threads', str(ffmpeg_threads)],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
        }

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
        raise HTTPException(status_code=500, detail=f"Erro ao processar áudio do YouTube: {str(e)}")
    
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


def _download_full_track_auto_match(artist: str, title: str, expected_duration: int, file_id: str) -> str:
    """
    Localiza e baixa automaticamente a faixa completa em alta qualidade usando os metadados e duração oficial da Deezer.
    """
    cpu_count = os.cpu_count() or 1
    ffmpeg_threads = max(1, cpu_count - 1)

    search_query = f"ytsearch5:{artist} - {title} official audio"
    search_opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'extract_flat': True,
    }

    target_url = None
    try:
        with YoutubeDL(search_opts) as ydl_search:
            search_info = ydl_search.extract_info(search_query, download=False)
            entries = [e for e in (search_info.get('entries') or []) if e]

            if entries:
                if expected_duration and expected_duration > 30:
                    # Filtra vídeos muito longos (ex: shows completos/compilações) e ordena pela proximidade da duração oficial da Deezer
                    valid_entries = [
                        e for e in entries
                        if not e.get('duration') or (30 <= e.get('duration', 0) <= max(expected_duration * 2, 900))
                    ]
                    candidates = valid_entries if valid_entries else entries
                    candidates.sort(
                        key=lambda e: abs((e.get('duration') or expected_duration) - expected_duration)
                    )
                    best = candidates[0]
                else:
                    best = entries[0]

                target_url = best.get('url') or best.get('webpage_url') or (f"https://www.youtube.com/watch?v={best['id']}" if best.get('id') else None)
    except Exception as search_err:
        print(f"[Auto-Match Search Warning] {search_err}")

    if not target_url:
        target_url = f"ytsearch1:{artist} - {title} audio"

    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'extract_flat': False,
        'outtmpl': os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s"),
        'postprocessor_args': ['-threads', str(ffmpeg_threads)],
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    downloaded_file = None
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

    if not downloaded_file or not os.path.exists(downloaded_file):
        raise Exception("Não foi possível obter o arquivo de áudio completo para a faixa selecionada.")

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

    # Garante que músicas vindas da API sempre utilizem a capa oficial do álbum na Deezer
    if not cover_image_url and deezer_track_id:
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
        raise HTTPException(status_code=500, detail=f"Erro ao obter e separar o áudio do catálogo: {str(e)}")

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