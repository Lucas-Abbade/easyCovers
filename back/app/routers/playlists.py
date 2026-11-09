import os
import shutil
import time
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

router = APIRouter(tags=["Playlists"])

PLAYLIST_PICS_DIR = "static/playlist_pics"
os.makedirs(PLAYLIST_PICS_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def is_valid_image(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXTENSIONS


def serialize_song(song: models.Song) -> dict:
    return {
        "id": song.id,
        "name": song.name,
        "artist": song.artist,
        "genre": song.genre,
        "instrument": song.instrument,
        "original_key": song.original_key.value if hasattr(song.original_key, "value") else str(song.original_key or "Unknown"),
        "cover_image_url": song.cover_image_url,
        "folder_path": song.folder_path,
        "practice_markers": song.practice_markers or "[]",
        "user_id": song.user_id,
    }


def serialize_playlist(playlist: models.Playlist) -> dict:
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description or "",
        "cover_image_url": playlist.cover_image_url or "",
        "user_id": playlist.user_id,
        "created_at": playlist.created_at.isoformat() if playlist.created_at else None,
        "songs": [serialize_song(s) for s in (playlist.songs or [])],
    }


@router.get("/playlists/{user_id}")
def get_user_playlists(user_id: int, db: Session = Depends(get_db)):
    playlists = (
        db.query(models.Playlist)
        .filter(models.Playlist.user_id == user_id)
        .order_by(models.Playlist.id.desc())
        .all()
    )
    return [serialize_playlist(p) for p in playlists]


@router.post("/playlists/{user_id}")
async def create_playlist(
    user_id: int,
    db: Session = Depends(get_db),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="O nome da playlist é obrigatório.")

    cover_url = ""
    if cover_image and cover_image.filename:
        if not is_valid_image(cover_image.filename):
            raise HTTPException(
                status_code=400,
                detail="Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF.",
            )
        ext = cover_image.filename.rsplit(".", 1)[-1].lower()
        timestamp = int(time.time() * 1000)
        file_name = f"playlist_{user_id}_{timestamp}.{ext}"
        file_path = os.path.join(PLAYLIST_PICS_DIR, file_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)

        cover_url = f"http://localhost:8000/static/playlist_pics/{file_name}"

    playlist = models.Playlist(
        name=cleaned_name,
        description=(description or "").strip(),
        cover_image_url=cover_url,
        user_id=user_id,
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "status": "sucesso",
        "message": "Playlist criada com sucesso!",
        "playlist": serialize_playlist(playlist),
    }


@router.put("/playlists/{playlist_id}")
async def update_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    remove_cover: Optional[bool] = Form(False),
    cover_image: Optional[UploadFile] = File(None),
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada.")

    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="O nome da playlist é obrigatório.")

    playlist.name = cleaned_name
    playlist.description = (description or "").strip()

    if remove_cover:
        playlist.cover_image_url = ""

    if cover_image and cover_image.filename:
        if not is_valid_image(cover_image.filename):
            raise HTTPException(
                status_code=400,
                detail="Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF.",
            )
        ext = cover_image.filename.rsplit(".", 1)[-1].lower()
        timestamp = int(time.time() * 1000)
        file_name = f"playlist_{playlist.user_id}_{timestamp}.{ext}"
        file_path = os.path.join(PLAYLIST_PICS_DIR, file_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)

        playlist.cover_image_url = f"http://localhost:8000/static/playlist_pics/{file_name}"

    db.commit()
    db.refresh(playlist)

    return {
        "status": "sucesso",
        "message": "Playlist atualizada com sucesso!",
        "playlist": serialize_playlist(playlist),
    }


@router.delete("/playlists/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada.")

    if playlist.cover_image_url and "/static/playlist_pics/" in playlist.cover_image_url:
        file_name = playlist.cover_image_url.split("/static/playlist_pics/")[-1]
        local_path = os.path.join(PLAYLIST_PICS_DIR, file_name)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception as e:
                print(f"Aviso ao remover imagem da playlist {local_path}: {e}")

    db.delete(playlist)
    db.commit()

    return {"status": "sucesso", "message": "Playlist excluída com sucesso."}


@router.post("/playlists/{playlist_id}/songs")
def add_songs_to_playlist(playlist_id: int, data: dict, db: Session = Depends(get_db)):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada.")

    song_ids = data.get("song_ids", [])
    if "song_id" in data and data["song_id"] is not None:
        song_ids = list(song_ids) + [data["song_id"]]

    if not isinstance(song_ids, list):
        raise HTTPException(status_code=400, detail="Formato inválido para lista de músicas.")

    existing_ids = {s.id for s in (playlist.songs or [])}
    for sid in song_ids:
        if sid in existing_ids:
            continue
        song = db.query(models.Song).filter(models.Song.id == sid).first()
        if song:
            playlist.songs.append(song)
            existing_ids.add(sid)

    db.commit()
    db.refresh(playlist)

    return {
        "status": "sucesso",
        "message": "Músicas adicionadas à playlist.",
        "playlist": serialize_playlist(playlist),
    }


@router.delete("/playlists/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(playlist_id: int, song_id: int, db: Session = Depends(get_db)):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada.")

    song_to_remove = next((s for s in (playlist.songs or []) if s.id == song_id), None)
    if not song_to_remove:
        raise HTTPException(status_code=404, detail="Música não encontrada nesta playlist.")

    playlist.songs.remove(song_to_remove)
    db.commit()
    db.refresh(playlist)

    return {
        "status": "sucesso",
        "message": "Música removida da playlist.",
        "playlist": serialize_playlist(playlist),
    }

