from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
from ..database import get_db
from ..models import User, EmailVerification
from ..schemas import (
    UserCredentials,
    VerifyEmailRequest,
    ResendVerificationRequest,
    VerificationStatusResponse,
)
from ..services import email_service
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


import secrets
import hashlib
import hmac

def hash_password(password: str) -> str:
    """Gera hash criptográfico PBKDF2-HMAC-SHA256 padrão NIST com 100.000 iterações e salt aleatório."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_value: str) -> bool:
    """Verifica senha com proteção contra timing attacks e compatibilidade retroativa segura."""
    if not plain_password or not hashed_value:
        return False
    if hashed_value.startswith("pbkdf2:sha256:"):
        try:
            parts = hashed_value.split("$")
            if len(parts) == 3:
                salt = parts[1]
                expected_key_hex = parts[2]
                candidate_key = hashlib.pbkdf2_hmac(
                    "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000
                )
                return hmac.compare_digest(candidate_key.hex(), expected_key_hex)
        except Exception:
            return False
    # Fallback em tempo constante para eventuais contas legadas criadas em texto plano
    return hmac.compare_digest(plain_password, hashed_value)


@router.post("/register/")
def register_user(
    credentials: UserCredentials,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    raw_email = (credentials.email or "").strip()
    raw_username = (credentials.username or "").strip()
    password = credentials.password or ""

    # Validação estrita de formato e proteção contra injeções CRLF (CWE-93)
    try:
        email = email_service.validate_email_address(raw_email)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail="Por favor, informe um endereço de e-mail válido.")

    if not raw_username:
        raise HTTPException(status_code=400, detail="Por favor, informe um nome de usuário.")

    username = _sanitize_username(raw_username)
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="O nome de usuário deve ter pelo menos 3 caracteres.")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 8 caracteres.")

    has_upper = bool(re.search(r"[A-Z]", password))
    has_digit = bool(re.search(r"\d", password))
    if not has_upper or not has_digit:
        raise HTTPException(
            status_code=400,
            detail="A senha deve conter pelo menos 1 letra maiúscula e 1 número."
        )

    # Hash criptográfico imediato da senha fornecida
    pwd_hash = hash_password(password)

    # Verifica se o e-mail já está cadastrado (case-insensitive)
    db_user_by_email = db.query(User).filter(func.lower(User.email) == email).first()
    if db_user_by_email:
        if db_user_by_email.is_email_verified:
            if not db_user_by_email.hashed_password:
                raise HTTPException(
                    status_code=400,
                    detail="Este e-mail já está vinculado a uma conta Google. Use o botão 'Continuar com o Google' para entrar.",
                )
            raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado. Faça login ou use outro e-mail.")
        else:
            # Verifica se o username escolhido já pertence a outro usuário
            db_user_by_username = db.query(User).filter(func.lower(User.username) == username.lower()).first()
            if db_user_by_username and db_user_by_username.id != db_user_by_email.id:
                raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso. Escolha outro.")

            # Proteção contra Pre-Account Takeover (CWE-287):
            # A senha da conta não é sobrescrita até que a posse do e-mail seja comprovada via OTP.
            # Armazena o pending_password_hash e pending_username no registro de verificação.
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_requests = (
                db.query(EmailVerification)
                .filter(EmailVerification.email == email, EmailVerification.created_at >= one_hour_ago)
                .count()
            )
            if recent_requests >= 6:
                raise HTTPException(
                    status_code=429,
                    detail="Limite de tentativas excedido para este e-mail nesta hora. Tente novamente mais tarde."
                )
    else:
        # Verifica se o username já está em uso por outro usuário
        db_user_by_username = db.query(User).filter(func.lower(User.username) == username.lower()).first()
        if db_user_by_username:
            raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso. Escolha outro.")

        novo_usuario = User(
            username=username,
            email=email,
            hashed_password=pwd_hash,
            is_profile_completed=False,
            is_email_verified=False,
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

    # Invalida códigos anteriores não usados desse e-mail
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.is_used == False
    ).update({"is_used": True})

    # Gera OTP seguro, salt e hash
    code = email_service.generate_otp_code()
    salt = email_service.generate_salt()
    code_hash = email_service.hash_otp_code(code, salt)
    expire_minutes = int(os.environ.get("VERIFICATION_CODE_EXPIRE_MINUTES", "15"))
    cooldown_seconds = int(os.environ.get("VERIFICATION_RESEND_COOLDOWN_SECONDS", "60"))

    verification = EmailVerification(
        email=email,
        code_hash=code_hash,
        salt=salt,
        attempts=0,
        max_attempts=5,
        expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
        created_at=datetime.utcnow(),
        is_used=False,
        purpose="register",
        pending_password_hash=pwd_hash,
        pending_username=username,
    )
    db.add(verification)
    db.commit()

    # Dispara o envio do e-mail em segundo plano
    background_tasks.add_task(email_service.send_verification_email, email, code, "register")

    return {
        "status": "pending_verification",
        "message": "Código de verificação enviado para o seu e-mail.",
        "email": email,
        "resend_cooldown": cooldown_seconds,
    }


@router.post("/verify-email/")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    code = (payload.code or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="E-mail é obrigatório.")
    if not code:
        raise HTTPException(status_code=400, detail="Por favor, informe o código de verificação de 6 dígitos.")

    db_user = db.query(User).filter(func.lower(User.email) == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if db_user.is_email_verified:
        return {
            "status": "sucesso",
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username,
            "full_name": db_user.full_name or "",
            "profile_picture_url": db_user.profile_picture_url or "",
            "is_profile_completed": bool(db_user.is_profile_completed),
            "is_email_verified": True,
        }

    # Busca o código pendente mais recente
    verification = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.is_used == False)
        .order_by(EmailVerification.id.desc())
        .first()
    )

    if not verification:
        raise HTTPException(
            status_code=400,
            detail="Nenhum código pendente encontrado para este e-mail. Solicite um novo código.",
        )

    # Verifica expiração
    if datetime.utcnow() > verification.expires_at:
        verification.is_used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="O código de verificação expirou. Por favor, clique em 'Reenviar código'.",
        )

    # Verifica limite de tentativas
    if verification.attempts >= verification.max_attempts:
        verification.is_used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Limite de tentativas excedido para este código. Solicite um novo código.",
        )

    # Validação do código em tempo constante
    is_valid = email_service.verify_otp_code(code, verification.salt, verification.code_hash)
    if not is_valid:
        verification.attempts += 1
        remaining = max(0, verification.max_attempts - verification.attempts)
        if remaining == 0:
            verification.is_used = True
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Código incorreto. Limite de tentativas atingido. Por segurança, solicite um novo código.",
            )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Código de verificação incorreto. Você tem mais {remaining} tentativa(s).",
        )

    # Código válido!
    verification.is_used = True
    db_user.is_email_verified = True
    if verification.pending_password_hash:
        db_user.hashed_password = verification.pending_password_hash
    if getattr(verification, "pending_username", None):
        db_user.username = verification.pending_username
    db.commit()
    db.refresh(db_user)

    return {
        "status": "sucesso",
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "full_name": db_user.full_name or "",
        "profile_picture_url": db_user.profile_picture_url or "",
        "is_profile_completed": bool(db_user.is_profile_completed),
        "is_email_verified": True,
    }


@router.post("/resend-verification/")
def resend_verification(
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Informe o e-mail para reenvio.")

    cooldown_seconds = int(os.environ.get("VERIFICATION_RESEND_COOLDOWN_SECONDS", "60"))

    # Proteção contra enumeração de contas (CWE-208):
    # Se o usuário não existir ou já estiver verificado, retornamos status de sucesso genérico
    # sem disparar e-mail nem revelar a existência da conta a um atacante.
    db_user = db.query(User).filter(func.lower(User.email) == email).first()
    if not db_user or db_user.is_email_verified:
        return {
            "status": "code_sent",
            "message": "Se este e-mail estiver cadastrado e pendente de verificação, um novo código foi enviado.",
            "email": email,
            "resend_cooldown": cooldown_seconds,
        }

    # Proteção contra abuso e exaustão de recursos (Rate limit: máx 5 solicitações por hora)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    hourly_requests = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email, EmailVerification.created_at >= one_hour_ago)
        .count()
    )
    if hourly_requests >= 5:
        raise HTTPException(
            status_code=429,
            detail="Limite de solicitações de código excedido para este e-mail nesta hora. Aguarde antes de tentar novamente.",
        )

    latest = (
        db.query(EmailVerification)
        .filter(EmailVerification.email == email)
        .order_by(EmailVerification.id.desc())
        .first()
    )

    if latest:
        seconds_passed = (datetime.utcnow() - latest.created_at).total_seconds()
        if seconds_passed < cooldown_seconds:
            remaining = int(cooldown_seconds - seconds_passed)
            raise HTTPException(
                status_code=429,
                detail=f"Aguarde {remaining} segundo(s) antes de solicitar um novo código.",
            )

    # Invalida códigos antigos pendentes
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.is_used == False
    ).update({"is_used": True})

    code = email_service.generate_otp_code()
    salt = email_service.generate_salt()
    code_hash = email_service.hash_otp_code(code, salt)
    expire_minutes = int(os.environ.get("VERIFICATION_CODE_EXPIRE_MINUTES", "15"))

    verification = EmailVerification(
        email=email,
        code_hash=code_hash,
        salt=salt,
        attempts=0,
        max_attempts=5,
        expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
        created_at=datetime.utcnow(),
        is_used=False,
        purpose="resend",
        pending_password_hash=latest.pending_password_hash if latest else None,
        pending_username=getattr(latest, "pending_username", None) if latest else None,
    )
    db.add(verification)
    db.commit()

    background_tasks.add_task(email_service.send_verification_email, email, code, "resend")

    return {
        "status": "code_sent",
        "message": "Novo código de verificação enviado para o seu e-mail.",
        "email": email,
        "resend_cooldown": cooldown_seconds,
    }


@router.post("/login/")
def login_user(
    credentials: UserCredentials,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
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

    if not verify_password(password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    # Se a senha no banco ainda estava em formato legado (texto plano),
    # atualiza transparentemente para o hash PBKDF2-HMAC-SHA256 agora que o usuário logou com sucesso.
    if not db_user.hashed_password.startswith("pbkdf2:sha256:"):
        db_user.hashed_password = hash_password(password)
        db.commit()

    # Verifica se o e-mail foi confirmado
    if not db_user.is_email_verified:
        # Envia novo código caso não haja um recente nos últimos 60 segundos
        latest = (
            db.query(EmailVerification)
            .filter(EmailVerification.email == email)
            .order_by(EmailVerification.id.desc())
            .first()
        )
        should_send = True
        cooldown_seconds = int(os.environ.get("VERIFICATION_RESEND_COOLDOWN_SECONDS", "60"))
        if latest and (datetime.utcnow() - latest.created_at).total_seconds() < cooldown_seconds:
            should_send = False

        if should_send:
            db.query(EmailVerification).filter(
                EmailVerification.email == email,
                EmailVerification.is_used == False
            ).update({"is_used": True})

            code = email_service.generate_otp_code()
            salt = email_service.generate_salt()
            code_hash = email_service.hash_otp_code(code, salt)
            expire_minutes = int(os.environ.get("VERIFICATION_CODE_EXPIRE_MINUTES", "15"))

            verification = EmailVerification(
                email=email,
                code_hash=code_hash,
                salt=salt,
                attempts=0,
                max_attempts=5,
                expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
                created_at=datetime.utcnow(),
                is_used=False,
                purpose="login_unverified",
                pending_password_hash=db_user.hashed_password,
                pending_username=db_user.username,
            )
            db.add(verification)
            db.commit()
            background_tasks.add_task(email_service.send_verification_email, email, code, "login_unverified")

        raise HTTPException(
            status_code=403,
            detail="Seu e-mail ainda não foi verificado. Enviamos um código para validação no seu e-mail.",
        )

    return {
        "status": "sucesso",
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "full_name": db_user.full_name or "",
        "profile_picture_url": db_user.profile_picture_url or "",
        "is_profile_completed": bool(db_user.is_profile_completed),
        "is_email_verified": True,
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
            is_email_verified=True,
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
                "is_email_verified": True,
            }

    # Se o usuário já existe (ex.: criou conta por e-mail antes), enriquece dados ausentes e confirma e-mail
    updated = False
    if not db_user.is_email_verified:
        db_user.is_email_verified = True
        updated = True
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
        "is_email_verified": True,
    }
