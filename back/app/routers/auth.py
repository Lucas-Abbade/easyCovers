from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..models import User
from ..schemas import UserCredentials
from pydantic import BaseModel
import os
import re

# google auth
import google.oauth2.id_token
import google.auth.transport.requests
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

router = APIRouter(tags=["Auth"])

DEFAULT_GOOGLE_CLIENT_ID = "306538057431-96v86vvcrqvi556j85o2gad7mr5irf45.apps.googleusercontent.com"

# Sessão HTTP resiliente com retry automático para validação de certificados/tokens do Google
_GOOGLE_HTTP_SESSION = requests.Session()
_RETRY_STRATEGY = Retry(
    total=2,
    backoff_factor=0.3,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)
_ADAPTER = HTTPAdapter(max_retries=_RETRY_STRATEGY, pool_connections=8, pool_maxsize=8)
_GOOGLE_HTTP_SESSION.mount("https://", _ADAPTER)
_GOOGLE_HTTP_SESSION.mount("http://", _ADAPTER)


class TokenPayload(BaseModel):
    id_token: str


def _sanitize_username(raw_value: str) -> str:
    """Limpa e padroniza um nome de usuário, removendo espaços e caracteres inválidos."""
    cleaned = re.sub(r"[^a-zA-Z0-9_.]", "_", (raw_value or "").strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("._")
    return cleaned[:24] or "musico"


def _generate_unique_username(db: Session, base_seed: str) -> str:
    """Gera um username único no banco de dados (comparação case-insensitive)."""
    base = _sanitize_username(base_seed)[:20]
    candidate = base
    counter = 1
    while (
        db.query(User)
        .filter(func.lower(User.username) == candidate.lower())
        .first()
        is not None
    ):
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


@router.post("/register/")
def register_user(credentials: UserCredentials, db: Session = Depends(get_db)):
    email = (credentials.email or "").strip().lower()
    raw_username = (credentials.username or "").strip()
    password = credentials.password or ""

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Por favor, informe um endereço de e-mail válido.")

    if not raw_username:
        raise HTTPException(status_code=400, detail="Por favor, informe um nome de usuário.")

    username = raw_username.replace(" ", "_")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="O nome de usuário deve ter pelo menos 3 caracteres.")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 8 caracteres.")

    # Verifica se o e-mail já está cadastrado (case-insensitive)
    db_user_by_email = db.query(User).filter(func.lower(User.email) == email).first()
    if db_user_by_email:
        if not db_user_by_email.hashed_password:
            raise HTTPException(
                status_code=400,
                detail="Este e-mail já está vinculado a uma conta Google. Use o botão 'Continuar com o Google' para entrar.",
            )
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado. Faça login ou use outro e-mail.")

    # Verifica se o username já está em uso (evita IntegrityError 500)
    db_user_by_username = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if db_user_by_username:
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso. Escolha outro.")

    novo_usuario = User(
        username=username,
        email=email,
        hashed_password=password,
        is_profile_completed=False,
    )

    try:
        db.add(novo_usuario)
        db.commit()
        db.refresh(novo_usuario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível concluir o cadastro: e-mail ou nome de usuário já está em uso.",
        )

    return {
        "status": "sucesso",
        "id": novo_usuario.id,
        "email": novo_usuario.email,
        "username": novo_usuario.username,
        "full_name": novo_usuario.full_name or "",
        "profile_picture_url": novo_usuario.profile_picture_url or "",
        "is_profile_completed": False,
    }


@router.post("/login/")
def login_user(credentials: UserCredentials, db: Session = Depends(get_db)):
    email = (credentials.email or "").strip().lower()
    password = credentials.password or ""

    if not email or not password:
        raise HTTPException(status_code=400, detail="Informe seu e-mail e senha para entrar.")

    db_user = db.query(User).filter(func.lower(User.email) == email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    # Conta criada exclusivamente via Google OAuth (sem senha cadastrada)
    if not db_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Esta conta foi criada com o Google. Utilize o botão 'Continuar com o Google' abaixo para entrar.",
        )

    if db_user.hashed_password != password:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    return {
        "status": "sucesso",
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "full_name": db_user.full_name or "",
        "profile_picture_url": db_user.profile_picture_url or "",
        "is_profile_completed": bool(db_user.is_profile_completed),
    }


@router.post("/auth/google/")
def google_auth(token: TokenPayload, db: Session = Depends(get_db)):
    raw_token = (token.id_token or "").strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="Token de autenticação do Google não foi fornecido.")

    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or DEFAULT_GOOGLE_CLIENT_ID).strip()

    id_info = None
    try:
        request = google.auth.transport.requests.Request(session=_GOOGLE_HTTP_SESSION)
        # clock_skew_in_seconds=300 evita falha "Token used too early" quando o relógio local do PC
        # está alguns minutos atrasado ou adiantado em relação aos servidores do Google.
        id_info = google.oauth2.id_token.verify_oauth2_token(
            raw_token,
            request,
            client_id,
            clock_skew_in_seconds=300,
        )
    except Exception as primary_err:
        # Fallback: valida o token diretamente no endpoint tokeninfo do Google
        try:
            resp = _GOOGLE_HTTP_SESSION.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": raw_token},
                timeout=10,
            )
            if resp.status_code != 200:
                raise ValueError(f"Google tokeninfo retornou status {resp.status_code}: {resp.text}")

            id_info = resp.json()
            if id_info.get("aud") != client_id:
                raise ValueError("O Client ID (audience) do token não corresponde ao aplicativo.")

            issuer = id_info.get("iss", "")
            if issuer and issuer not in ("accounts.google.com", "https://accounts.google.com"):
                raise ValueError("Emissor (issuer) do token inválido.")
        except Exception as fallback_err:
            err_msg = str(primary_err)
            if "Token expired" in err_msg or "expired" in str(fallback_err).lower():
                raise HTTPException(
                    status_code=401,
                    detail="Sua sessão do Google expirou. Clique novamente no botão do Google para entrar.",
                )
            raise HTTPException(
                status_code=400,
                detail=f"Não foi possível validar sua credencial do Google. Tente novamente. ({fallback_err})",
            )

    email = (id_info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Sua conta Google não forneceu um endereço de e-mail válido.")

    name = (id_info.get("name") or id_info.get("given_name") or email.split("@")[0]).strip()
    picture = (id_info.get("picture") or "").strip()

    db_user = db.query(User).filter(func.lower(User.email) == email).first()
    if not db_user:
        username = _generate_unique_username(db, email.split("@")[0])
        novo = User(
            username=username,
            email=email,
            hashed_password="",
            full_name=name,
            profile_picture_url=picture,
            is_profile_completed=False,
        )
        try:
            db.add(novo)
            db.commit()
            db.refresh(novo)
        except IntegrityError:
            db.rollback()
            # Caso raro de concorrência: busca usuário recém-criado ou gera novo username
            db_user = db.query(User).filter(func.lower(User.email) == email).first()
            if not db_user:
                raise HTTPException(
                    status_code=400,
                    detail="Erro ao criar usuário com sua conta Google. Tente novamente.",
                )
        else:
            return {
                "status": "created",
                "id": novo.id,
                "email": novo.email,
                "username": novo.username,
                "full_name": novo.full_name or "",
                "profile_picture_url": novo.profile_picture_url or "",
                "is_profile_completed": False,
            }

    # Se o usuário já existe (ex.: criou conta por e-mail antes), enriquece dados ausentes
    updated = False
    if not db_user.full_name and name:
        db_user.full_name = name
        updated = True
    if not db_user.profile_picture_url and picture:
        db_user.profile_picture_url = picture
        updated = True
    if updated:
        try:
            db.commit()
            db.refresh(db_user)
        except Exception:
            db.rollback()

    return {
        "status": "ok",
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "full_name": db_user.full_name or "",
        "profile_picture_url": db_user.profile_picture_url or "",
        "is_profile_completed": bool(db_user.is_profile_completed),
    }
