@echo off
setlocal
cd /d "%~dp0"
echo === Moni Implantacao ===

if not exist "backend\.venv\Scripts\python.exe" (
  echo Criando ambiente Python...
  py -m venv backend\.venv || python -m venv backend\.venv
)
call backend\.venv\Scripts\activate
pip install -r backend\requirements.txt -q

if not exist "frontend\dist\index.html" (
  echo Compilando o frontend ^(so na primeira vez^)...
  pushd frontend
  call npm install
  call npm run build
  popd
)

cd backend
echo.
echo Sistema disponivel em http://localhost:8000  ^(na rede: http://IP-DESTA-MAQUINA:8000^)
uvicorn app.main:app --host 0.0.0.0 --port 8000
