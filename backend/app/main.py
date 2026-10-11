"""
CEBIX — Backend de inferencia en vivo (Reto AgroCebada 2026)
=============================================================

Backend real: carga el modelo entrenado (Random Forest, top-10 features) UNA vez y cada
request lo EJECUTA de verdad; no hay resultados precalculados.

Estructura:
    app/main.py            crea la app (CORS + routers)
    app/config.py          rutas y variables de entorno
    app/schemas.py         modelos de entrada (Pydantic)
    app/api/               endpoints agrupados por tema
    app/services/          lógica: modelo/inferencia, features satelitales y lectura de archivos geográficos

Endpoints:
    GET  /health, /                       estado del servicio
    GET  /features, /model-info           descripción del modelo
    GET  /example-csv                     CSV de ejemplo
    POST /predict, /predict-csv           predicción sobre features ya calculadas
    GET  /satellite-status                proveedor satelital activo
    POST /predict-from-geometry           polígono GeoJSON + año -> features en vivo + predicción
    POST /parse-geometry                  SHP (.zip o .shp+.dbf+.prj) / GeoJSON / KML / KMZ -> polígonos lng/lat

Correr localmente (desde backend/):
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import geo, health, model, predict, satellite
from app.config import ALLOWED_ORIGIN_REGEX, ALLOWED_ORIGINS

app = FastAPI(
    title="CEBIX — API de inferencia (Reto AgroCebada 2026)",
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

for r in (health.router, model.router, predict.router, satellite.router, geo.router):
    app.include_router(r)
