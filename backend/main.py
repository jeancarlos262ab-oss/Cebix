"""
Reto AgroCebada 2026 — Backend de inferencia en vivo
=======================================================

Este es un backend real: carga el modelo entrenado (Random Forest, top-10 features,
model_artifact.joblib) UNA VEZ al arrancar, y cada request lo EJECUTA de verdad —
no hay resultados precalculados aquí. Es lo que responde a "que permita ejecutar el
modelo predictivo" de las bases del reto.

Endpoints:
  GET  /health           — health check ligero (no carga el modelo)
  GET  /model-info       — métricas de validación, comparación de algoritmos, SHAP global,
                           preguntas guía... (lo genera ml/03_modelo/build_model_meta.py)
  GET  /example-csv      — CSV de ejemplo (parcelas de evaluación, con lat/lng) para /predict-csv
  GET  /                 — info básica, para probar que el servicio está vivo
  GET  /features         — la lista de las 10 features que el modelo espera, con su
                            nombre legible (para construir un formulario o validar un CSV)
  POST /predict          — una o varias parcelas en JSON -> predicción real
  POST /predict-csv      — un CSV (mismo formato que features_predict.csv del pipeline)
                            -> predicción real de cada fila, en JSON

Correr localmente:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Probar:
    curl http://localhost:8000/features
    curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" \
         -d '{"parcelas": [{"ID_POLIGONO": "TEST_01", "Estado": "Hidalgo", "features": {...}}]}'
"""

import io
import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "model_artifact.joblib"))
META_PATH = os.environ.get("MODEL_META_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_meta.json"))
EXAMPLE_CSV_PATH = os.environ.get("EXAMPLE_CSV_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ejemplo_features_predict.csv"))

app = FastAPI(
    title="CEBIX — API de inferencia (Reto AgroCebada 2026)",
    description="Ejecuta en vivo el modelo real de rendimiento de cebada (Random Forest, top-10 features SHAP).",
    version="1.0.0",
)

# CORS: en Render se define ALLOWED_ORIGINS con el dominio del frontend en Vercel
# (varios separados por coma, sin "/" al final), p. ej.:
#   ALLOWED_ORIGINS=https://cebix.vercel.app,https://cebix.com
# ALLOWED_ORIGIN_REGEX es opcional, para aceptar también los previews de Vercel:
#   ALLOWED_ORIGIN_REGEX=https://cebix-.*[.]vercel[.]app
# Si no se define ALLOWED_ORIGINS, acepta cualquier origen ("*"), útil solo en local.
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
ALLOWED_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

_artifact = None
_explainer = None


def get_artifact():
    global _artifact, _explainer
    if _artifact is None:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(status_code=500, detail=f"No se encontró el modelo en {MODEL_PATH}")
        _artifact = joblib.load(MODEL_PATH)
        _explainer = shap.TreeExplainer(_artifact["model"])
    return _artifact, _explainer


class ParcelaInput(BaseModel):
    ID_POLIGONO: str
    Estado: str = Field(default="Puebla", description="Hidalgo, Puebla o Tlaxcala (define el margen de confianza)")
    features: dict = Field(description="Las 10 features del modelo -> ver GET /features")


class PredictRequest(BaseModel):
    parcelas: list[ParcelaInput]


def run_inference(rows_df, estados):
    artifact, explainer = get_artifact()
    feature_order = artifact["feature_order"]

    for col in feature_order:
        if col not in rows_df.columns:
            rows_df[col] = np.nan  # el imputer entrenado rellena con la mediana de train

    X_raw = rows_df[feature_order]
    X_imp = artifact["imputer"].transform(X_raw)
    X_scaled = artifact["scaler"].transform(X_imp)
    X_scaled_df = pd.DataFrame(X_scaled, columns=feature_order)

    point_pred = artifact["model"].predict(X_scaled_df)

    rng = np.random.default_rng(42)
    residuals = artifact["residuals_oof"]
    lowers, uppers = [], []
    for p in point_pred:
        boots = p + rng.choice(residuals, size=300, replace=True)
        lowers.append(float(np.quantile(boots, 0.05)))
        uppers.append(float(np.quantile(boots, 0.95)))

    shap_values = explainer(X_scaled_df)

    results = []
    for i in range(len(rows_df)):
        estado = estados[i]
        confidence = artifact["rmse_by_region"].get(estado, artifact["overall_rmse"])
        local_shap = shap_values.values[i]
        order = np.argsort(-np.abs(local_shap))[:4]
        shap_out = [
            {
                "feature": artifact["feature_labels"].get(feature_order[j], feature_order[j]),
                "impact": round(float(local_shap[j]), 3),
                "direction": "positivo" if local_shap[j] >= 0 else "negativo",
            }
            for j in order
        ]
        results.append({
            "yieldEstimate": round(float(point_pred[i]), 2),
            "ic90_inferior": round(lowers[i], 2),
            "ic90_superior": round(uppers[i], 2),
            "confidence": round(confidence, 2),
            "shap": shap_out,
        })
    return results


PASSTHROUGH_FIELDS = ["Municipio", "lat", "lng", "area_ha"]


def _clean(v):
    """JSON no admite NaN/inf: se devuelve None y el frontend lo trata como 'sin dato'."""
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, np.integer):
        return int(v)
    return v


def _meta(df, i):
    """Datos de contexto que venían en el CSV (municipio, coordenadas, área) y se devuelven tal cual."""
    return {c: _clean(df[c].iloc[i]) for c in PASSTHROUGH_FIELDS if c in df.columns}


@app.get("/health")
def health():
    # Ligero: no carga el modelo. Es el health check de Render.
    return {"status": "ok"}


_meta_cache = None


@app.get("/model-info")
def model_info():
    """Todo lo que describe al modelo (métricas, SHAP global, textos). El frontend no trae nada de esto fijo."""
    global _meta_cache
    if _meta_cache is None:
        if not os.path.exists(META_PATH):
            raise HTTPException(
                status_code=500,
                detail="Falta model_meta.json. Genéralo con: python ml/03_modelo/build_model_meta.py",
            )
        with open(META_PATH, encoding="utf-8") as f:
            _meta_cache = json.load(f)
    return _meta_cache


@app.get("/example-csv")
def example_csv():
    if not os.path.exists(EXAMPLE_CSV_PATH):
        raise HTTPException(status_code=404, detail="Falta backend/data/ejemplo_features_predict.csv (ver ml/build_example_csv.py).")
    return FileResponse(EXAMPLE_CSV_PATH, media_type="text/csv", filename="ejemplo_features_predict.csv")


@app.get("/")
def root():
    artifact, _ = get_artifact()
    return {
        "status": "ok",
        "modelo": artifact["model_name"],
        "n_features": len(artifact["feature_order"]),
        "rmse_global_leave_region_out": round(artifact["overall_rmse"], 3),
        "mensaje": "Backend de inferencia REAL. Cada llamada a /predict corre el modelo, no devuelve datos precalculados.",
    }


@app.get("/features")
def list_features():
    artifact, _ = get_artifact()
    return {
        "features": [
            {"key": f, "label": artifact["feature_labels"].get(f, f)}
            for f in artifact["feature_order"]
        ]
    }


@app.post("/predict")
def predict(payload: PredictRequest):
    if not payload.parcelas:
        raise HTTPException(status_code=400, detail="Manda al menos una parcela en 'parcelas'.")

    rows = [p.features for p in payload.parcelas]
    ids = [p.ID_POLIGONO for p in payload.parcelas]
    estados = [p.Estado for p in payload.parcelas]

    df = pd.DataFrame(rows)
    meta_df = df.copy()  # run_inference agrega columnas al DataFrame; el contexto se lee antes
    results = run_inference(df, estados)

    return {
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **_meta(meta_df, i), **results[i]}
            for i in range(len(ids))
        ]
    }


@app.post("/predict-csv")
async def predict_csv(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el CSV: {e}")

    if "ID_POLIGONO" not in df.columns:
        raise HTTPException(status_code=400, detail="El CSV necesita una columna ID_POLIGONO.")

    estados = df["Estado"].tolist() if "Estado" in df.columns else ["Puebla"] * len(df)
    ids = df["ID_POLIGONO"].tolist()

    results = run_inference(df.copy(), estados)

    return {
        "n_parcelas": len(df),
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **_meta(df, i), **results[i]}
            for i in range(len(ids))
        ],
    }
