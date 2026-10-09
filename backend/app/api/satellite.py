"""Parcelas nuevas: calcula las 10 features desde satélite y corre el modelo."""

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.schemas import GeometryRequest
from app.services import satellite_service
from app.services.features.gee import GeeError
from app.services.model_service import get_artifact, run_inference

router = APIRouter(tags=["satélite"])


@router.get("/satellite-status")
def satellite_status():
    """Diagnóstico sin tocar la red: proveedor activo y si sus librerías/credenciales están listas."""
    return satellite_service.status()


@router.post("/predict-from-geometry")
def predict_from_geometry(payload: GeometryRequest):
    """
    Calcula en vivo las 10 features de una parcela nueva desde satélite y corre el modelo.
    Con el proveedor por defecto (fuentes abiertas, sin cuenta) tarda ~30–90 s. Un solo cálculo a la vez.

    Errores: 422 geometría/año inválidos o sin datos satelitales, 429 otro cálculo en curso,
    502 falla de la fuente de imágenes, 503 librerías o credenciales faltantes en el servidor.
    """
    try:
        extracted = satellite_service.extract(payload.geometry, payload.anio)
    except GeeError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None

    features = extracted["features"]
    df = pd.DataFrame([features]).astype(float)  # None -> NaN: el imputer entrenado los rellena
    result = run_inference(df, [payload.Estado])[0]

    advertencias = list(extracted["advertencias"])
    if payload.anio != 2025:
        advertencias.append(f"El modelo se entrenó con el ciclo 2025; para {payload.anio} extrapola (clima distinto).")
    artifact, _ = get_artifact()
    if payload.Estado not in artifact["rmse_by_region"]:
        advertencias.append(f"«{payload.Estado}» no es un estado de entrenamiento: se usó el margen de confianza global.")

    return {
        "ID_POLIGONO": payload.ID_POLIGONO,
        "Estado": payload.Estado,
        "anio": payload.anio,
        "proveedor": satellite_service.provider(),
        "area_ha": extracted["area_ha"],
        "features_calculadas": features,
        "advertencias": advertencias,
        **result,
    }
