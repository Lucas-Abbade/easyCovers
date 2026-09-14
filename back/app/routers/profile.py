from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import shutil
import os
import time

from ..database import get_db 
from .. import models

router = APIRouter(tags=["Profile"])

UPLOAD_DIR = "static/profile_pics"
BANNER_DIR = "static/banner_pics"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(BANNER_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}

def is_valid_image(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXTENSIONS

# --- 1. ROTA GET: BUSCAR DADOS COMPLETOS DO PERFIL ---
@router.get("/profile/{user_id}")
async def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    songs_data = [
        {
            "id": song.id,
            "name": song.name,
            "artist": song.artist,
            "genre": song.genre,
            "instrument": song.instrument,
            "original_key": song.original_key.value if hasattr(song.original_key, 'value') else str(song.original_key)
        }
        for song in (user.songs or [])
    ]

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username or "",
        "full_name": user.full_name or "",
        "bio": user.bio or "",
        "instrument": user.instrument or "",
        "favorite_genres": user.favorite_genres or "",
        "favorite_artists": user.favorite_artists or "",
        "profile_picture_url": user.profile_picture_url or "",
        "banner_picture_url": user.banner_picture_url or "",
        "location": user.location or "",
        "experience_level": user.experience_level or "",
        "social_instagram": user.social_instagram or "",
        "social_youtube": user.social_youtube or "",
        "social_spotify": user.social_spotify or "",
        "social_x": user.social_x or "",
        "is_profile_completed": bool(user.is_profile_completed),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "songs_count": len(user.songs or []),
        "recent_songs": list(reversed(songs_data[-6:]))
    }


# --- 2. ROTA POST: SALVAR E ATUALIZAR DADOS DO PERFIL ---
@router.post("/update-profile/{user_id}")
async def update_profile(
    user_id: int,
    db: Session = Depends(get_db),
    full_name: str = Form(...),
    username: str = Form(...),
    bio: Optional[str] = Form(None),
    instrument: Optional[str] = Form(None),
    favorite_genres: Optional[str] = Form(None),
    favorite_artists: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    experience_level: Optional[str] = Form(None),
    social_instagram: Optional[str] = Form(None),
    social_youtube: Optional[str] = Form(None),
    social_spotify: Optional[str] = Form(None),
    social_x: Optional[str] = Form(None),
    remove_picture: Optional[bool] = Form(False),
    remove_banner: Optional[bool] = Form(False),
    profile_picture: Optional[UploadFile] = File(None),
    banner_picture: Optional[UploadFile] = File(None)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    cleaned_username = username.strip().replace(" ", "_")
    if not cleaned_username:
        raise HTTPException(status_code=400, detail="Nome de usuário inválido.")

    # Validação de username único se alterado
    if cleaned_username != user.username:
        existing_user = db.query(models.User).filter(models.User.username == cleaned_username).first()
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso. Escolha outro.")
        user.username = cleaned_username

    # Atualiza as informações de texto
    user.full_name = full_name.strip() if full_name else ""
    user.bio = bio.strip() if bio else ""
    user.instrument = instrument.strip() if instrument else ""
    user.favorite_genres = favorite_genres.strip() if favorite_genres else ""
    user.favorite_artists = favorite_artists.strip() if favorite_artists else ""
    user.location = location.strip() if location else ""
    user.experience_level = experience_level.strip() if experience_level else ""
    user.social_instagram = social_instagram.strip() if social_instagram else ""
    user.social_youtube = social_youtube.strip() if social_youtube else ""
    user.social_spotify = social_spotify.strip() if social_spotify else ""
    user.social_x = social_x.strip() if social_x else ""
    
    # Marca o perfil como concluído após a primeira configuração
    user.is_profile_completed = True

    # Remoção explícita de foto de perfil
    if remove_picture:
        user.profile_picture_url = ""

    # Salva a nova imagem de perfil
    if profile_picture and profile_picture.filename:
        if not is_valid_image(profile_picture.filename):
            raise HTTPException(status_code=400, detail="Formato de imagem de perfil inválido. Use PNG, JPG ou WEBP.")
        
        file_extension = profile_picture.filename.rsplit(".", 1)[-1].lower()
        timestamp = int(time.time())
        file_name = f"user_{user_id}_{timestamp}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)
            
        user.profile_picture_url = f"http://localhost:8000/static/profile_pics/{file_name}"

    # Remoção explícita de banner de capa
    if remove_banner:
        user.banner_picture_url = ""

    # Salva novo banner de capa
    if banner_picture and banner_picture.filename:
        if not is_valid_image(banner_picture.filename):
            raise HTTPException(status_code=400, detail="Formato de banner inválido. Use PNG, JPG ou WEBP.")
            
        banner_ext = banner_picture.filename.rsplit(".", 1)[-1].lower()
        timestamp = int(time.time())
        banner_name = f"banner_{user_id}_{timestamp}.{banner_ext}"
        banner_path = os.path.join(BANNER_DIR, banner_name)
        
        with open(banner_path, "wb") as buffer:
            shutil.copyfileobj(banner_picture.file, buffer)
            
        user.banner_picture_url = f"http://localhost:8000/static/banner_pics/{banner_name}"

    # Confirma as alterações no banco de dados
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Perfil atualizado com sucesso!",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "profile_picture_url": user.profile_picture_url or "",
            "banner_picture_url": user.banner_picture_url or "",
            "is_profile_completed": user.is_profile_completed
        }
    }


# --- 3. ROTA POST: CONCLUIR ONBOARDING / PULAR POR ENQUANTO ---
@router.post("/profile/{user_id}/complete-onboarding")
async def complete_onboarding(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.is_profile_completed = True
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Onboarding concluído.",
        "is_profile_completed": True
    }
