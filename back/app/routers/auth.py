from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserCredentials
from pydantic import BaseModel
import os

# google auth
import google.oauth2.id_token
import google.auth.transport.requests
import requests

router = APIRouter(tags=["Auth"])


class TokenPayload(BaseModel):
    id_token: str


@router.post("/register/")
def register_user(credentials: UserCredentials, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == credentials.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado.")
    
    novo_usuario = User(
        username=credentials.username, 
        email=credentials.email, 
        hashed_password=credentials.password
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    
    return {"status": "sucesso", "id": novo_usuario.id, "email": novo_usuario.email, "username": novo_usuario.username}


@router.post("/login/")
def login_user(credentials: UserCredentials, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == credentials.email).first()
    if not db_user or db_user.hashed_password != credentials.password:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos.")
    
    return {"status": "sucesso", "id": db_user.id, "email": db_user.email}


@router.post("/auth/google/")
def google_auth(token: TokenPayload, db: Session = Depends(get_db)):
    # Prefer env var, fallback to known client id (provided by user) to simplify local dev.
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    if not client_id:
        # Fallback (developer provided). For production, set the env var instead.
        client_id = '306538057431-96v86vvcrqvi556j85o2gad7mr5irf45.apps.googleusercontent.com'

    try:
        request = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(token.id_token, request, client_id)
    except Exception as e:
        # Fallback: verify token via Google's tokeninfo endpoint to avoid local clock issues
        try:
            resp = requests.get('https://oauth2.googleapis.com/tokeninfo', params={'id_token': token.id_token}, timeout=5)
            if resp.status_code != 200:
                raise Exception(resp.text)
            id_info = resp.json()
            # validate audience
            if id_info.get('aud') != client_id:
                raise Exception('Audience inválido no token do Google.')
        except Exception as e2:
            raise HTTPException(status_code=400, detail=f"Token inválido: {e2}")

    email = id_info.get('email')
    name = id_info.get('name') or id_info.get('given_name') or email.split('@')[0]
    picture = id_info.get('picture')

    if not email:
        raise HTTPException(status_code=400, detail="Email não encontrado no token do Google.")

    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        # gerar username baseado no email, garantindo unicidade
        base = email.split('@')[0].replace('.', '_')[:20]
        username = base
        i = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}{i}"
            i += 1

        novo = User(username=username, email=email, hashed_password='', full_name=name, profile_picture_url=picture)
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return {"status": "created", "id": novo.id, "email": novo.email, "username": novo.username}

    return {"status": "ok", "id": db_user.id, "email": db_user.email, "username": db_user.username}