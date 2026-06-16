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
    if caminho_da_pasta:
        caminho_absoluto = os.path.abspath(caminho_da_pasta)
        if os.path.exists(caminho_absoluto):
            try:
                shutil.rmtree(caminho_absoluto)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Erro ao deletar arquivos: {e}")
        else:
            print(f"Pasta de stems não encontrada: {caminho_absoluto}")
    
    db.delete(song)
    db.commit()
    
    return {"status": "sucesso", "message": "Música e arquivos deletados."}