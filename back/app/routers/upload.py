import os
import shutil
import uuid
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
    
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        print(f"Processando: {name} - ID: {musica_id}")
        
        # Normaliza o áudio usando loudnorm
        normalized_path = f"temp_{musica_id}_normalized.mp3"
        normalize_audio(temp_path, normalized_path)
        
        # Chama a função de Inteligência Artificial encapsulada com o arquivo normalizado
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

        return {"status": "sucesso", "id": nova_musica.id, "folder": musica_folder, "original_key": original_key}

    except Exception as e:
        print(f"Erro: {e}")
        raise HTTPException(status_code=500, detail="Erro no processamento")
    
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        # Remove também o arquivo normalizado se existir
        normalized_path = f"temp_{musica_id}_normalized.mp3"
        if os.path.exists(normalized_path):
            os.remove(normalized_path)


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
            'js_runtimes': {'node': {}},
            'quiet': False,
            'no_warnings': False,
        }

        # 2. Download do áudio
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            song_title = info.get('title', 'Musica do YouTube')

        # 3. Normaliza o áudio usando loudnorm
        normalized_path = os.path.join(musica_folder, f"{file_id}_normalized.mp3")
        normalize_audio(output_filename, normalized_path)
        os.remove(output_filename)  # Remove o arquivo original após normalizar

        # 4. Chame o Demucs com o arquivo normalizado
        process_demucs(normalized_path, musica_folder)

        # 5. Salva no Banco de Dados
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

        # 6. Retorna o OBJETO completo
        return nova_musica

    except Exception as e:
        print(f"Erro no YouTube: {e}")
        raise HTTPException(status_code=500, detail="Erro ao baixar vídeo do YouTube")
    
    finally:
        # Remove os arquivos temporários
        if os.path.exists(output_filename):
            os.remove(output_filename)
        normalized_path = os.path.join(musica_folder, f"{file_id}_normalized.mp3")
        if os.path.exists(normalized_path):
            os.remove(normalized_path)