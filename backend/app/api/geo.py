from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.services import geo_service
from app.services.geo_service import GeoParseError

router = APIRouter(tags=["geoprocesamiento"])

@router.post("/parse-geometry")
async def parse_geometry(files: list[UploadFile] = File(...)):
    
    uploads: list[tuple[str, bytes]] = []
    for f in files:
        data = await f.read()  
        uploads.append((f.filename or "archivo", data))
    try:
        return await run_in_threadpool(geo_service.parse_uploads, uploads)
    except GeoParseError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None