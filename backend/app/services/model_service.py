import json
import os

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import HTTPException

from app.config import (
    DOMAIN_GEO_MARGIN_DEG,
    DOMAIN_PRECIP_MARGIN,
    IC_INFLATION,
    META_PATH,
    MODEL_10VAR_CICLO_PATH,
    MODEL_10VAR_PATH,
    MODEL_CICLO_PATH,
    MODEL_PATH,
    MODEL_PLANET_PATH,
    PARCELAS_OFICIALES_PATH,
    PASSTHROUGH_FIELDS,
    PLANET_META_PATH,
)

_cache: dict = {}  
_meta_cache = None
_PATHS = {"abierto": MODEL_PATH, "10var": MODEL_10VAR_PATH, "ciclo": MODEL_CICLO_PATH, "10var_ciclo": MODEL_10VAR_CICLO_PATH, "planet": MODEL_PLANET_PATH}

MODOS = {"lluvia": "abierto", "10var": "10var", "ciclo": "ciclo", "10var_ciclo": "10var_ciclo"}

# Variantes que usan la lluvia de las 3 etapas del ciclo (abr–oct) en vez de solo abril–mayo.
VARIANTES_CICLO = ("ciclo", "10var_ciclo")

def modo_from_variant(variant: str) -> str:
    """Nombre público del modo que devuelve la API (lo guarda el frontend con cada parcela)."""
    return variant if variant in ("10var", "ciclo", "10var_ciclo") else "lluvia"

def variant_from_modo(modo: str | None) -> str:
    
    m = (modo or "lluvia").strip().lower()
    if m not in MODOS:
        raise HTTPException(status_code=422, detail="modo debe ser 'lluvia', '10var', 'ciclo' o '10var_ciclo'.")
    return MODOS[m]

def get_artifact(variant: str = "abierto"):
    
    if variant not in _cache:
        path = _PATHS[variant]
        if not os.path.exists(path):
            raise HTTPException(status_code=500, detail=f"No se encontró el modelo ({variant}) en {path}")
        art = joblib.load(path)
        _cache[variant] = (art, shap.TreeExplainer(art["model"]))
    return _cache[variant]

def get_planet_meta():
    
    if not os.path.exists(PLANET_META_PATH):
        return None
    with open(PLANET_META_PATH, encoding="utf-8") as f:
        return json.load(f)

def get_model_meta():
    
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

_PRECIP = "precip_acum_emergencia_macollamiento_mm"
_PRECIP_EXTRA = {
    "precip_acum_encanado_mm": "encañado (jun–jul)",
    "precip_acum_espigado_llenado_mm": "espigado-llenado (ago–sep)",
}
_domain_cache: dict | None = None

def get_domain() -> dict:
    
    global _domain_cache
    if _domain_cache is None:
        try:
            ref = pd.read_csv(PARCELAS_OFICIALES_PATH)
            tr = ref[ref["CONJUNTO"] == "ENTRENAMIENTO"]
            _domain_cache = {
                "precip": (float(tr[_PRECIP].min()), float(tr[_PRECIP].max())),
                "precip_extra": {
                    c: (float(tr[c].min()), float(tr[c].max()))
                    for c in _PRECIP_EXTRA
                    if c in tr.columns
                },
                "lat": (float(tr["lat"].min()), float(tr["lat"].max())),
                "lng": (float(tr["lng"].min()), float(tr["lng"].max())),
                "estados": set(tr["Estado"].dropna().unique()),
            }
        except Exception:
            _domain_cache = {}
    return _domain_cache

def domain_warnings(row, estado) -> list[str]:
    
    d = get_domain()
    if not d:
        return []
    out = []
    if estado and estado not in d["estados"]:
        out.append(f"El estado «{estado}» no estuvo en el entrenamiento (solo Hidalgo, Puebla y Tlaxcala).")
    p = row.get(_PRECIP)
    if p is not None and np.isfinite(p):
        lo, hi = d["precip"]
        m = (hi - lo) * DOMAIN_PRECIP_MARGIN
        if p < lo - m or p > hi + m:
            out.append(
                f"La lluvia de abril–mayo ({p:.0f} mm) queda fuera del rango visto al entrenar ({lo:.0f}–{hi:.0f} mm): "
                "la estimación es una extrapolación."
            )
    for col, etapa in _PRECIP_EXTRA.items():
        v = row.get(col)
        rng = d.get("precip_extra", {}).get(col)
        if v is not None and rng is not None and np.isfinite(v):
            lo, hi = rng
            m = (hi - lo) * DOMAIN_PRECIP_MARGIN
            if v < lo - m or v > hi + m:
                out.append(
                    f"La lluvia de {etapa} ({v:.0f} mm) queda fuera del rango visto al entrenar ({lo:.0f}–{hi:.0f} mm): "
                    "la estimación es una extrapolación."
                )
    lat, lng = row.get("lat"), row.get("lng")
    if lat is not None and lng is not None and np.isfinite(lat) and np.isfinite(lng):
        (la0, la1), (ln0, ln1) = d["lat"], d["lng"]
        g = DOMAIN_GEO_MARGIN_DEG
        if not (la0 - g <= lat <= la1 + g and ln0 - g <= lng <= ln1 + g):
            out.append("La parcela está lejos de la zona donde se entrenó el modelo (oriente de Hidalgo / norte de Puebla / Tlaxcala).")
    return out

def run_inference(rows_df, estados, variant: str = "abierto"):
    artifact, explainer = get_artifact(variant)
    feature_order = artifact["feature_order"]

    for col in feature_order:
        if col not in rows_df.columns:
            rows_df[col] = np.nan  

    
    
    required = artifact.get("required_features") or []
    if required:
        faltan = rows_df[required].isna().any(axis=1)
        if faltan.any():
            ids = rows_df.loc[faltan, "ID_POLIGONO"].astype(str).tolist() if "ID_POLIGONO" in rows_df.columns else []
            muestra = ", ".join(ids[:5]) + (f" y {len(ids) - 5} más" if len(ids) > 5 else "")
            raise HTTPException(
                status_code=422,
                detail="Falta la lluvia que usa el modelo (" + ", ".join(required) + ")"
                + (f", en: {muestra}." if ids else ".")
                + " No se estima sin ella.",
            )

    X_raw = rows_df[feature_order]
    
    imputed_cols = X_raw.isna()
    X_imp = artifact["imputer"].transform(X_raw)
    X_scaled = artifact["scaler"].transform(X_imp)
    X_scaled_df = pd.DataFrame(X_scaled, columns=feature_order)

    point_pred = artifact["model"].predict(X_scaled_df)

    
    
    
    residuals = np.asarray(artifact["residuals_oof"], dtype=float)
    by_state = artifact.get("residuals_by_state") or {}
    q_global = np.quantile(residuals, [0.05, 0.95])
    q_state = {}
    for st, r in by_state.items():
        r = np.asarray(r, dtype=float)
        q_state[st] = np.quantile(r, [0.05, 0.95]) if len(r) >= 20 else q_global
    
    lowers = [float(p + IC_INFLATION * q_state.get(estados[i], q_global)[0]) for i, p in enumerate(point_pred)]
    uppers = [float(p + IC_INFLATION * q_state.get(estados[i], q_global)[1]) for i, p in enumerate(point_pred)]

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
        row = {c: pd.to_numeric(rows_df.iloc[i].get(c), errors="coerce") for c in (_PRECIP, *(_PRECIP_EXTRA if variant in VARIANTES_CICLO else ()), "lat", "lng") if c in rows_df.columns}
        avisos = domain_warnings(row, estado)
        results.append({
            "fuera_de_rango": bool(avisos),
            "avisos": avisos,
            "modo": modo_from_variant(variant),
            "variables_imputadas": faltantes,
            "yieldEstimate": round(float(point_pred[i]), 2),
            "ic90_inferior": round(lowers[i], 2),
            "ic90_superior": round(uppers[i], 2),
            "confidence": round(confidence, 2),
            "shap": shap_out,
        })
    return results

def _clean(v):
    
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, np.integer):
        return int(v)
    return v

def row_context(df, i):
    
    return {c: _clean(df[c].iloc[i]) for c in PASSTHROUGH_FIELDS if c in df.columns}