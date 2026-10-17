"""Información del modelo: features esperadas, métricas y CSV de ejemplo."""

import io
import os
import zipfile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

from app.config import EXAMPLE_DATOS_PATH, EXAMPLE_PLANET_PATH
from app.config import DOMAIN_GEO_MARGIN_DEG, DOMAIN_PRECIP_MARGIN
from app.services.model_service import get_artifact, get_domain, get_model_meta, get_planet_meta

router = APIRouter(tags=["modelo"])


@router.get("/model-info")
def model_info():
    """Todo lo que describe al modelo (métricas, SHAP global, textos). El frontend no trae nada de esto fijo."""
    meta = dict(get_model_meta())
    planet = get_planet_meta()
    if planet:
        meta["planetModel"] = planet
    d = get_domain()
    if d:  # dominio de entrenamiento: el frontend avisa de parcelas "fuera de rango" aunque se hayan guardado antes
        meta["dominio"] = {
            "precip": list(d["precip"]),
            "lat": list(d["lat"]),
            "lng": list(d["lng"]),
            "estados": sorted(d["estados"]),
            "margenPrecip": DOMAIN_PRECIP_MARGIN,
            "margenGrados": DOMAIN_GEO_MARGIN_DEG,
        }
    return meta


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
def example_csv(tipo: str = Query("datos", description="'datos' (por defecto), 'planet' o 'todos' (un .zip con ambos).")):
    """Archivo de ejemplo en el mismo formato que el de carga: con él se puede probar la aplicación."""
    if tipo == "todos":
        files = [(EXAMPLE_DATOS_PATH, "datos_ejemplo.csv"), (EXAMPLE_PLANET_PATH, "planet_ejemplo.csv")]
        if not all(os.path.exists(p) for p, _ in files):
            raise HTTPException(status_code=404, detail="No se encontraron los archivos de ejemplo.")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for p, n in files:
                z.write(p, n)
        return Response(buf.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="ejemplos.zip"'})
    path, name = (
        (EXAMPLE_PLANET_PATH, "planet_ejemplo.csv") if tipo == "planet" else (EXAMPLE_DATOS_PATH, "datos_ejemplo.csv")
    )
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="No se encontró el archivo de ejemplo.")
    return FileResponse(path, media_type="text/csv", filename=name)
