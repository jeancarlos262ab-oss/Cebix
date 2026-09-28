#!/usr/bin/env bash
# Arranca el backend usando el entorno virtual (Linux/macOS). Uso: ./run.sh
cd "$(dirname "$0")"
[ -d .venv ] || ./setup_venv.sh
. .venv/bin/activate
uvicorn main:app --reload --port 8000
