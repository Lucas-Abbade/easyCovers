import os
import shutil
import uuid
import glob
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

        nova_musica = Song(
            name=name,
            artist=artist,
            genre=genre,
            original_key=original_key,
            instrument=instrument,
            folder_path=musica_folder,
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
            "original_key": original_key
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

        # Salva no Banco de Dados
        nova_musica = Song(
            name=custom_title or song_title,
            artist=custom_artist or "YouTube",
            genre=custom_genre or "Unknown",
            original_key=custom_original_key or "Unknown",
            instrument=custom_instrument or "Unknown",
            folder_path=musica_folder,
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