import pandas as pd
from fastapi import APIRouter, HTTPException

from app.schemas import GeometryRequest
from app.services import satellite_service
from app.services.features.common import SatelliteError
from app.services.model_service import get_artifact, run_inference, variant_from_modo

router = APIRouter(tags=["satélite"])

@router.get("/satellite-status")
def satellite_status():
    
    return satellite_service.status()

@router.post("/predict-from-geometry")
def predict_from_geometry(payload: GeometryRequest):
    
    try:
        extracted = satellite_service.extract(payload.geometry, payload.anio)
    except SatelliteError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None

    features = extracted["features"]
    df = pd.DataFrame([features]).astype(float)  
    variant = variant_from_modo(payload.modo)
    advertencias = list(extracted["advertencias"])
    if variant == "ciclo":
        try:
            extra = satellite_service.extract_ciclo(payload.geometry, payload.anio)
        except SatelliteError as e:
            raise HTTPException(status_code=e.status, detail=e.message) from None
        features = {**features, **extra["features"]}
        df = pd.DataFrame([features]).astype(float)
        advertencias += extra["advertencias"]
    result = run_inference(df, [payload.Estado], variant)[0]

    if payload.anio != 2025:
        advertencias.append(f"El modelo se entrenó con el ciclo 2025; para {payload.anio} extrapola (clima distinto).")
    artifact, _ = get_artifact(variant)
    if result["variables_imputadas"]:
        advertencias.append("Sin dato satelital (nubes o pocas imágenes) y rellenadas con la mediana de entrenamiento: " + ", ".join(result["variables_imputadas"]) + ".")
    if payload.Estado not in artifact["rmse_by_region"]:
        advertencias.append(f"'{payload.Estado}' no es un estado de entrenamiento: se usó el margen de confianza global.")

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