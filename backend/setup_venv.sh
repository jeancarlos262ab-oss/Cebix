#!/usr/bin/env bash
# Crea el entorno virtual e instala dependencias (Linux/macOS). Uso: ./setup_venv.sh
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "Listo. Arranca con: ./run.sh"
