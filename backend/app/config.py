import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = os.environ.get("MODEL_PATH", str(BASE_DIR / "models" / "model_artifact.joblib"))
META_PATH = os.environ.get("MODEL_META_PATH", str(BASE_DIR / "models" / "model_meta.json"))
MODEL_10VAR_PATH = os.environ.get("MODEL_10VAR_PATH", str(BASE_DIR / "models" / "model_artifact_10var.joblib"))
MODEL_10VAR_CICLO_PATH = os.environ.get("MODEL_10VAR_CICLO_PATH", str(BASE_DIR / "models" / "model_artifact_10var_ciclo.joblib"))
MODEL_CICLO_PATH = os.environ.get("MODEL_CICLO_PATH", str(BASE_DIR / "models" / "model_artifact_ciclo.joblib"))
MODEL_PLANET_PATH = os.environ.get("MODEL_PLANET_PATH", str(BASE_DIR / "models" / "model_artifact_planet.joblib"))
PLANET_META_PATH = os.environ.get("MODEL_PLANET_META_PATH", str(BASE_DIR / "models" / "model_planet_meta.json"))
EXAMPLE_CSV_PATH = os.environ.get("EXAMPLE_CSV_PATH", str(BASE_DIR / "data" / "ejemplo_features_predict.csv"))

EXAMPLE_DATOS_PATH = os.environ.get("EXAMPLE_DATOS_PATH", str(BASE_DIR / "data" / "ejemplo_basico.csv"))
EXAMPLE_PLANET_PATH = os.environ.get("EXAMPLE_PLANET_PATH", str(BASE_DIR / "data" / "ejemplo_planet.csv"))
PARCELAS_OFICIALES_PATH = os.environ.get("PARCELAS_OFICIALES_PATH", str(BASE_DIR / "data" / "parcelas_oficiales.csv"))

ALLOWED_ORIGINS = [
    o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]
ALLOWED_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX") or None

PASSTHROUGH_FIELDS = ["Municipio", "lat", "lng", "area_ha", "CONJUNTO"]

IC_INFLATION = float(os.environ.get("IC_INFLATION", "1.3"))

DOMAIN_PRECIP_MARGIN = float(os.environ.get("DOMAIN_PRECIP_MARGIN", "0.10"))
DOMAIN_GEO_MARGIN_DEG = float(os.environ.get("DOMAIN_GEO_MARGIN_DEG", "0.15"))