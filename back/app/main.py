import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importações dos nossos próprios módulos
from .database import engine, Base
from .routers import auth, songs, upload

# Cria as tabelas no banco de dados
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EasyCovers API")

# Configuração de pastas e arquivos estáticos
os.makedirs("storage/stems", exist_ok=True)
app.mount("/stems", StaticFiles(directory="storage/stems"), name="stems")

# Configuração de CORS para o React conseguir conversar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectando todos os roteadores na nossa aplicação principal
app.include_router(auth.router)
app.include_router(songs.router)
app.include_router(upload.router)

@app.get("/")
def root():
    return {"message": "API do EasyCovers está rodando!"}