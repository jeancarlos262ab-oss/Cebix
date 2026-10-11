"""Lectura de archivos de parcelas: Shapefile, GeoJSON, KML/KMZ -> polígonos para /predict-from-geometry."""

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.services import geo_service
from app.services.geo_service import MAX_UPLOAD_BYTES, GeoParseError

router = APIRouter(tags=["geoprocesamiento"])


@router.post("/parse-geometry")
async def parse_geometry(files: list[UploadFile] = File(...)):
    """
    Lee uno o varios archivos y devuelve los polígonos que traen, reproyectados a lng/lat (EPSG:4326).

    Un shapefile se manda como un `.zip`, o como los archivos sueltos `.shp` + `.dbf` + `.prj` (+ `.shx`)
    en la misma petición. Cada polígono trae `error` si no podría calcularse (área, vértices, geometría
    inválida), con el mismo motivo que daría /predict-from-geometry.
    """
    uploads: list[tuple[str, bytes]] = []
    total = 0
    for f in files:
        data = await f.read(MAX_UPLOAD_BYTES + 1)
        total += len(data)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"Los archivos superan el máximo de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
        uploads.append((f.filename or "archivo", data))
    try:
        return await run_in_threadpool(geo_service.parse_uploads, uploads)
    except GeoParseError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
