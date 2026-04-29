@echo off
echo Iniciando o EasyCovers...

:: Abre o Backend em uma nova janela
start cmd /k "cd back && venv\Scripts\activate && uvicorn app.main:app --reload"

:: Abre o Frontend na janela atual
cd front && npm run dev