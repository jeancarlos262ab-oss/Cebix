"""Configuración central: rutas de archivos y variables de entorno.

Todo lo que antes estaba disperso en main.py vive aquí. Cada ruta se puede sobreescribir
con una variable de entorno (útil en Docker/Render); si no, se usan las carpetas del repo.
"""

import os
from pathlib import Path

# backend/  (este archivo está en backend/app/config.py)
BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = os.environ.get("MODEL_PATH", str(BASE_DIR / "models" / "model_artifact.joblib"))
META_PATH = os.environ.get("MODEL_META_PATH", str(BASE_DIR / "models" / "model_meta.json"))
EXAMPLE_CSV_PATH = os.environ.get("EXAMPLE_CSV_PATH", str(BASE_DIR / "data" / "ejemplo_features_predict.csv"))

# CORS: en Render se define ALLOWED_ORIGINS con el dominio del frontend en Vercel
# (varios separados por coma, sin "/" al final), p. ej.:
#   ALLOWED_ORIGINS=https://cebix.vercel.app,https://cebix.com
# ALLOWED_ORIGIN_REGEX es opcional, para aceptar también los previews de Vercel:
#   ALLOWED_ORIGIN_REGEX=https://cebix-.*[.]vercel[.]app
# Si no se define ALLOWED_ORIGINS, acepta cualquier origen ("*"), útil solo en local.
ALLOWED_ORIGINS = [
    o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]
ALLOWED_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX") or None

# Proveedor de features satelitales: "stac" (fuentes abiertas, sin cuenta) o "gee" (Earth Engine).
FEATURES_PROVIDER = os.environ.get("FEATURES_PROVIDER", "stac")

# Campos que vienen en el CSV/JSON y se devuelven tal cual junto a la predicción.
PASSTHROUGH_FIELDS = ["Municipio", "lat", "lng", "area_ha"]
