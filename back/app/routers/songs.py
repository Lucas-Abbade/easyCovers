import os
import shutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Song

router = APIRouter(tags=["Songs"])

@router.get("/songs/{user_id}")
def get_user_songs(user_id: int, db: Session = Depends(get_db)):
    return db.query(Song).filter(Song.user_id == user_id).all()

@router.delete("/songs/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Música não encontrada.")
    
    caminho_da_pasta = song.folder_path
    if caminho_da_pasta and os.path.exists(caminho_da_pasta):
        shutil.rmtree(caminho_da_pasta)
        
    db.delete(song)
    db.commit()
    
    return {"status": "sucesso", "message": "Música e arquivos deletados."}