"""Carga del modelo entrenado y ejecución de inferencia (predicción + IC90 + SHAP local)."""

import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import HTTPException

from app.config import META_PATH, MODEL_PATH, PASSTHROUGH_FIELDS

_artifact = None
_explainer = None
_meta_cache = None


def get_artifact():
    """Carga el modelo UNA vez (perezosamente) y lo reutiliza en cada request."""
    global _artifact, _explainer
    if _artifact is None:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(status_code=500, detail=f"No se encontró el modelo en {MODEL_PATH}")
        _artifact = joblib.load(MODEL_PATH)
        _explainer = shap.TreeExplainer(_artifact["model"])
    return _artifact, _explainer


def get_model_meta():
    """Contenido de model_meta.json (métricas, SHAP global, textos)."""
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


def _clean(v):
    """JSON no admite NaN/inf: se devuelve None y el frontend lo trata como 'sin dato'."""
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, np.integer):
        return int(v)
    return v


def row_context(df, i):
    """Datos de contexto que venían en el CSV (municipio, coordenadas, área) y se devuelven tal cual."""
    return {c: _clean(df[c].iloc[i]) for c in PASSTHROUGH_FIELDS if c in df.columns}
