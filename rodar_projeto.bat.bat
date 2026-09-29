@echo off
echo Iniciando o EasyCovers...

:: Abre o Backend em uma nova janela usando o python.exe diretamente
start cmd /k "cd back && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload"

:: Abre o Frontend na janela atual
cd front && npm run dev