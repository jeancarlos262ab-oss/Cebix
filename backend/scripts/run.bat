@echo off
REM Arranca el backend usando el entorno virtual (Windows). Uso: scripts\run.bat
cd /d "%~dp0\.."
if not exist .venv call scripts\setup_venv.bat
call .venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
