@echo off
REM Arranca el backend usando el entorno virtual (Windows). Uso: run.bat
cd /d "%~dp0"
if not exist .venv call setup_venv.bat
call .venv\Scripts\activate.bat
uvicorn main:app --reload --port 8000
