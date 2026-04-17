import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Song
from ..services.audio_service import process_demucs

router = APIRouter(tags=["Upload"])

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