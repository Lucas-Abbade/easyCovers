import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from yt_dlp import YoutubeDL
from ..database import get_db
from ..models import Song
from ..services.audio_service import process_demucs

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
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    musica_id = str(uuid.uuid4())[:8]
    storage_base = "storage/stems"
    musica_folder = os.path.join(storage_base, musica_id)
    os.makedirs(musica_folder, exist_ok=True)
    
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        print(f"Processando: {name} - ID: {musica_id}")
        
        # Chama a função de Inteligência Artificial encapsulada
        process_demucs(temp_path, musica_folder)

        nova_musica = Song(
            name=name,
            artist=artist,
            genre=genre,
            instrument=instrument,
            folder_path=musica_folder,
            user_id=user_id 
        )
        db.add(nova_musica)
        db.commit()
        db.refresh(nova_musica)

        return {"status": "sucesso", "id": nova_musica.id, "folder": musica_folder}

    except Exception as e:
        print(f"Erro: {e}")
        raise HTTPException(status_code=500, detail="Erro no processamento")
    
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


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

    try:
        # 1. Configurações do YT-DLP
        file_id = str(uuid.uuid4())
        musica_id = str(uuid.uuid4())[:8]
        storage_base = "storage/stems"
        musica_folder = os.path.join(storage_base, musica_id)
        os.makedirs(musica_folder, exist_ok=True)

        output_filename = os.path.join(musica_folder, f"{file_id}.mp3")

        cpu_count = os.cpu_count() or 1
        ffmpeg_threads = max(1, cpu_count - 1)
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'extract_flat': False,
            'outtmpl': os.path.join(musica_folder, f"{file_id}.%(ext)s"),
            'postprocessor_args': ['-threads', str(ffmpeg_threads)],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }

        # 2. Download do áudio
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            song_title = info.get('title', 'Musica do YouTube')

        # 3. Chame o Spleeter de forma síncrona
        process_demucs(output_filename, musica_folder)

        # 5. Salva no Banco de Dados
        nova_musica = Song(
            name=custom_title or song_title,
            artist=custom_artist or "YouTube",
            genre=custom_genre or "Unknown",
            instrument=custom_instrument or "Unknown",
            folder_path=musica_folder,
            user_id=user_id
        )
        db.add(nova_musica)
        db.commit()
        db.refresh(nova_musica)

        # 6. Retorna o OBJETO completo
        return nova_musica

    except Exception as e:
        print(f"Erro no YouTube: {e}")
        raise HTTPException(status_code=500, detail="Erro ao baixar vídeo do YouTube")
    
    finally:
        if os.path.exists(output_filename):
            os.remove(output_filename)