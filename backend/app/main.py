import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api import geo, health, model, overpass, predict, satellite
from app.config import ALLOWED_ORIGIN_REGEX, ALLOWED_ORIGINS

app = FastAPI(
    title="CEBIX — API de inferencia",
    description="Ejecuta en vivo el modelo real de rendimiento de cebada (Random Forest, top-10 features SHAP).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (health.router, model.router, predict.router, satellite.router, geo.router, overpass.router):
    app.include_router(r)

@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    
    logging.getLogger("cebix").exception("Error no controlado en %s", request.url.path)
    headers = {}
    origin = request.headers.get("origin")
    if origin and ("*" in ALLOWED_ORIGINS or origin.rstrip("/") in ALLOWED_ORIGINS):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
    return JSONResponse({"detail": f"Error interno: {type(exc).__name__}: {exc}"}, status_code=500, headers=headers)