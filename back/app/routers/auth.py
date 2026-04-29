from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserCredentials

router = APIRouter(tags=["Auth"])

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