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


@router.get("/songs/{song_id}/markers")
def get_song_markers(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Música não encontrada.")

    try:
        import json
        raw = song.practice_markers or "[]"
        markers = json.loads(raw)
        if not isinstance(markers, list):
            markers = []
    except Exception as e:
        print(f"Erro ao decodificar practice_markers da música {song_id}: {e}")
        markers = []

    return {"status": "sucesso", "song_id": song_id, "markers": markers}


@router.put("/songs/{song_id}/markers")
def update_song_markers(song_id: int, data: dict, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Música não encontrada.")

    try:
        import json
        markers_data = data.get("markers", [])
        if not isinstance(markers_data, list):
            markers_data = []

        song.practice_markers = json.dumps(markers_data, ensure_ascii=False)
        db.commit()
        db.refresh(song)

        return {
            "status": "sucesso",
            "message": "Marcadores de treino atualizados.",
            "song_id": song_id,
            "markers": markers_data
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar marcadores: {str(e)}")