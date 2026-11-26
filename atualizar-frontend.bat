@echo off
cd /d "%~dp0frontend"
call npm install
call npm run build
echo Frontend recompilado. Reinicie o iniciar.bat se ele estiver aberto.
pause
