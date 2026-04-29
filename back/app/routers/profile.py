from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
import shutil
import os

# Importe o seu banco de dados e modelos (ajuste os pontinhos '.' dependendo de onde o arquivo está)
from ..database import get_db 
from .. import models

router = APIRouter(tags=["Profile"])

UPLOAD_DIR = "static/profile_pics"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- 1. ROTA GET: BUSCAR DADOS DO BANCO ---
@router.get("/profile/{user_id}")
async def get_profile(user_id: int, db: Session = Depends(get_db)):
    # Busca o usuário no banco
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Retorna os dados que estão salvos no banco
    return {
        "full_name": user.full_name or "",
        "username": user.username or "",
        "bio": user.bio or "",
        "instrument": user.instrument or "",
        "favorite_genres": user.favorite_genres or "",
        "favorite_artists": user.favorite_artists or "",
        "profile_picture_url": user.profile_picture_url or ""
    }


# --- 2. ROTA POST: SALVAR DADOS NO BANCO ---
@router.post("/update-profile/{user_id}")
async def update_profile(
    user_id: int,
    db: Session = Depends(get_db),
    full_name: str = Form(...),
    username: str = Form(...),
    bio: str = Form(None),
    instrument: str = Form(None),
    favorite_genres: str = Form(None),
    favorite_artists: str = Form(None),
    profile_picture: UploadFile = File(None)
):
    # Verifica se o usuário existe
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Atualiza as informações de texto
    user.full_name = full_name
    user.username = username
    user.bio = bio
    user.instrument = instrument
    user.favorite_genres = favorite_genres
    user.favorite_artists = favorite_artists

    # Salva a imagem no disco (se foi enviada uma nova)
    if profile_picture:
        file_extension = profile_picture.filename.split(".")[-1]
        file_name = f"user_{user_id}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)
            
        # Salva a URL da imagem no banco de dados para o React conseguir ler depois
        user.profile_picture_url = f"http://localhost:8000/static/profile_pics/{file_name}"

    # Confirma as alterações no banco de dados
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Perfil atualizado com sucesso!",
        "photo_url": user.profile_picture_url
    }