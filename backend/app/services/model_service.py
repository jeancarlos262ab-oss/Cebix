"""Carga del modelo entrenado y ejecución de inferencia (predicción + IC90 + SHAP local)."""

import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import HTTPException

from app.config import META_PATH, MODEL_10VAR_PATH, MODEL_PATH, MODEL_PLANET_PATH, PASSTHROUGH_FIELDS, PLANET_META_PATH

_cache: dict = {}  # variante -> (artefacto, explainer)
_meta_cache = None
_PATHS = {"abierto": MODEL_PATH, "10var": MODEL_10VAR_PATH, "planet": MODEL_PLANET_PATH}
# Modos que elige la persona en el front -> artefacto. "lluvia" es el modelo de producción; "10var" es el Plan B.
MODOS = {"lluvia": "abierto", "10var": "10var"}


def variant_from_modo(modo: str | None) -> str:
    """Traduce el parámetro `modo` de la API ('lluvia' por defecto o '10var') al artefacto; 422 si no existe."""
    m = (modo or "lluvia").strip().lower()
    if m not in MODOS:
        raise HTTPException(status_code=422, detail="modo debe ser 'lluvia' o '10var'.")
    return MODOS[m]


def get_artifact(variant: str = "abierto"):
    """Carga cada modelo UNA vez (perezosamente) y lo reutiliza. variant: 'abierto' (solo fuentes libres) o 'planet'."""
    if variant not in _cache:
        path = _PATHS[variant]
        if not os.path.exists(path):
            raise HTTPException(status_code=500, detail=f"No se encontró el modelo ({variant}) en {path}")
        art = joblib.load(path)
        _cache[variant] = (art, shap.TreeExplainer(art["model"]))
    return _cache[variant]


def get_planet_meta():
    """Resumen del modelo con Planet (métricas, variables, importancias); None si aún no se generó."""
    if not os.path.exists(PLANET_META_PATH):
        return None
    with open(PLANET_META_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_model_meta():
    """Contenido de model_meta.json (métricas, SHAP global, textos)."""
    global _meta_cache
    if _meta_cache is None:
        if not os.path.exists(META_PATH):
            raise HTTPException(
                status_code=500,
                detail="Falta model_meta.json. Genéralo con: python ml/03_modelo/entrenar_y_validar.py",
            )
        with open(META_PATH, encoding="utf-8") as f:
            _meta_cache = json.load(f)
    return _meta_cache


def run_inference(rows_df, estados, variant: str = "abierto"):
    artifact, explainer = get_artifact(variant)
    feature_order = artifact["feature_order"]

    for col in feature_order:
        if col not in rows_df.columns:
            rows_df[col] = np.nan  # el imputer entrenado rellena con la mediana de train

    # Variables sin las que NO se predice: rellenarlas con la mediana de entrenamiento daría una cifra que parece una
    # estimación y no lo es (el modelo se basa en la lluvia). Mejor un error claro.
    required = artifact.get("required_features") or []
    if required:
        faltan = rows_df[required].isna().any(axis=1)
        if faltan.any():
            ids = rows_df.loc[faltan, "ID_POLIGONO"].astype(str).tolist() if "ID_POLIGONO" in rows_df.columns else []
            muestra = ", ".join(ids[:5]) + (f" y {len(ids) - 5} más" if len(ids) > 5 else "")
            raise HTTPException(
                status_code=422,
                detail="Falta la lluvia de abril–mayo (precip_acum_emergencia_macollamiento_mm), la variable del modelo"
                + (f", en: {muestra}." if ids else ".")
                + " No se estima sin ella.",
            )

    X_raw = rows_df[feature_order]
    # Variables (distintas de las obligatorias) que no vinieron y se rellenan con la mediana de entrenamiento.
    imputed_cols = X_raw.isna()
    X_imp = artifact["imputer"].transform(X_raw)
    X_scaled = artifact["scaler"].transform(X_imp)
    X_scaled_df = pd.DataFrame(X_scaled, columns=feature_order)

    point_pred = artifact["model"].predict(X_scaled_df)

    # IC 90 %: percentiles 5 y 95 de los residuos fuera de muestra sumados a la predicción. Se usan los residuos del
    # estado de la parcela (recogen su sesgo y su dispersión) y, si el artefacto no los trae o el estado no está, los
    # de todas las parcelas. Es determinista: una parcela da el mismo intervalo sin importar el orden ni el tamaño del archivo.
    residuals = np.asarray(artifact["residuals_oof"], dtype=float)
    by_state = artifact.get("residuals_by_state") or {}
    q_global = np.quantile(residuals, [0.05, 0.95])
    q_state = {}
    for st, r in by_state.items():
        r = np.asarray(r, dtype=float)
        q_state[st] = np.quantile(r, [0.05, 0.95]) if len(r) >= 20 else q_global
    lowers = [float(p + q_state.get(estados[i], q_global)[0]) for i, p in enumerate(point_pred)]
    uppers = [float(p + q_state.get(estados[i], q_global)[1]) for i, p in enumerate(point_pred)]

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
        faltantes = [artifact["feature_labels"].get(c, c) for c in feature_order if imputed_cols.iloc[i][c]]
        results.append({
            "modo": "10var" if variant == "10var" else "lluvia",
            "variables_imputadas": faltantes,
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
