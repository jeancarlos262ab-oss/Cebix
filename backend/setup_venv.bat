@echo off
REM Crea el entorno virtual e instala dependencias (Windows). Uso: setup_venv.bat
cd /d "%~dp0"
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
echo Listo. Arranca con: run.bat
