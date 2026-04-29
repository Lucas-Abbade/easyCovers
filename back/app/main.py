import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importações dos nossos próprios módulos
from .database import engine, Base
# ADICIONADO: importação do router 'profile'
from .routers import auth, songs, upload, profile 

# Cria as tabelas no banco de dados
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EasyCovers API")

# Configuração de pastas
UPLOAD_DIR = "static/profile_pics"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("storage/stems", exist_ok=True)

# --- CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS ---
# Mantendo o seu de stems
app.mount("/stems", StaticFiles(directory="storage/stems"), name="stems")

# ADICIONADO: Montando a pasta 'static' para que o React acesse as fotos de perfil
# Isso permite acessar: http://localhost:8000/static/profile_pics/user_1.png
app.mount("/static", StaticFiles(directory="static"), name="static")


# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONECTANDO OS ROTEADORES ---
app.include_router(auth.router)
app.include_router(songs.router)
app.include_router(upload.router)
# ADICIONADO: Roteador de perfil
app.include_router(profile.router)

@app.get("/")
def root():
    return {"message": "API do EasyCovers está rodando!"}