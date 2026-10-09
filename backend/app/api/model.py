"""Información del modelo: features esperadas, métricas y CSV de ejemplo."""

import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import EXAMPLE_CSV_PATH
from app.services.model_service import get_artifact, get_model_meta

router = APIRouter(tags=["modelo"])


@router.get("/model-info")
def model_info():
    """Todo lo que describe al modelo (métricas, SHAP global, textos). El frontend no trae nada de esto fijo."""
    return get_model_meta()


@router.get("/features")
def list_features():
    artifact, _ = get_artifact()
    return {
        "features": [
            {"key": f, "label": artifact["feature_labels"].get(f, f)}
            for f in artifact["feature_order"]
        ]
    }


@router.get("/example-csv")
def example_csv():
    if not os.path.exists(EXAMPLE_CSV_PATH):
        raise HTTPException(
            status_code=404,
            detail="Falta backend/data/ejemplo_features_predict.csv (ver ml/build_example_csv.py).",
        )
    return FileResponse(EXAMPLE_CSV_PATH, media_type="text/csv", filename="ejemplo_features_predict.csv")
