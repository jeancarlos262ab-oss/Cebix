#!/usr/bin/env bash
# Arranca el backend usando el entorno virtual (Linux/macOS). Uso: ./scripts/run.sh
cd "$(dirname "$0")/.."
[ -d .venv ] || ./scripts/setup_venv.sh
. .venv/bin/activate
uvicorn app.main:app --reload --port 8000
