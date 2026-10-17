"""Predicción sobre features ya calculadas (JSON o CSV)."""

import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.schemas import PredictRequest
from app.services import official_dataset as official
from app.services.features.common import FEATURE_KEYS
from app.services.model_service import _clean, row_context, run_inference, variant_from_modo

router = APIRouter(tags=["predicción"])


@router.post("/predict")
def predict(payload: PredictRequest, modo: str = Query("lluvia", description="'lluvia' (por defecto) o '10var' (Plan B).")):
    if not payload.parcelas:
        raise HTTPException(status_code=400, detail="Manda al menos una parcela en 'parcelas'.")

    rows = [p.features for p in payload.parcelas]
    ids = [p.ID_POLIGONO for p in payload.parcelas]
    estados = [p.Estado for p in payload.parcelas]

    df = pd.DataFrame(rows)
    meta_df = df.copy()  # run_inference agrega columnas al DataFrame; el contexto se lee antes
    results = run_inference(df, estados, variant_from_modo(modo))

    return {
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **row_context(meta_df, i), **results[i]}
            for i in range(len(ids))
        ]
    }


@router.post("/predict-csv")
async def predict_csv(
    file: UploadFile = File(...),
    conjunto: str = Query(
        "PREDICCION",
        description="Solo para el CSV Básico oficial: PREDICCION (las 59 parcelas a estimar), ENTRENAMIENTO o TODAS.",
    ),
    modo: str = Query("lluvia", description="'lluvia' (solo la lluvia de abril–mayo, por defecto) o '10var' (Plan B: 10 variables)."),
):
    """Acepta (a) el CSV de features ya calculadas, (b) el CSV Básico OFICIAL del reto o (c) el CSV PRO (Planet) del reto.
    El tipo se detecta solo: con el PRO se usa el modelo con Planet; con los otros, el modelo de fuentes abiertas."""
    content = await file.read()
    try:
        columns = pd.read_csv(io.BytesIO(content), nrows=0, encoding="utf-8-sig").columns
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el CSV: {e}")

    if official.is_planet_csv(columns):
        return _predict_official_pro(content, conjunto, variant_from_modo(modo))
    if official.is_official_basico(columns):
        return _predict_official_basico(content, conjunto, variant_from_modo(modo))

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el CSV: {e}")

    if "ID_POLIGONO" not in df.columns:
        raise HTTPException(status_code=400, detail="El CSV necesita una columna ID_POLIGONO.")

    estados = df["Estado"].tolist() if "Estado" in df.columns else ["Puebla"] * len(df)
    ids = df["ID_POLIGONO"].tolist()

    results = run_inference(df.copy(), estados, variant_from_modo(modo))

    return {
        "n_parcelas": len(df),
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **row_context(df, i), **results[i]}
            for i in range(len(ids))
        ],
    }


def _predict_official_basico(content: bytes, conjunto: str, variant: str = "abierto"):
    conjunto = conjunto.strip().upper()
    if conjunto not in ("PREDICCION", "ENTRENAMIENTO", "TODAS"):
        raise HTTPException(status_code=400, detail="conjunto debe ser PREDICCION, ENTRENAMIENTO o TODAS.")
    try:
        raw = pd.read_csv(
            io.BytesIO(content),
            encoding="utf-8-sig",
            usecols=lambda c: c in official.USECOLS,
            dtype={"ID_POLIGONO": "string", "fecha_captura": "string", "sensor": "string"},
        )
        feats = official.features_from_basico(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el archivo: {e}")

    sin_referencia = int(feats["CONJUNTO"].isna().sum())
    if conjunto != "TODAS":
        # Parcelas que no están en la tabla oficial (sin CONJUNTO) se conservan: no hay motivo para descartarlas.
        feats = feats[(feats["CONJUNTO"] == conjunto) | feats["CONJUNTO"].isna()].reset_index(drop=True)
    if feats.empty:
        raise HTTPException(status_code=400, detail="El archivo no trae parcelas del conjunto pedido.")

    ids = feats["ID_POLIGONO"].tolist()
    estados = feats["Estado"].tolist()
    results = run_inference(feats.copy(), estados, variant)
    for r in results:
        r["modelo"] = "abierto"

    def context(i):
        extra = {k: _clean(feats[k].iloc[i]) for k in [*FEATURE_KEYS, "ndvi_pico_ciclo"]}
        return {**row_context(feats, i), **extra}

    return {
        "n_parcelas": len(feats),
        "fuente": "csv_basico_oficial",
        "conjunto": conjunto,
        "modelo": "abierto",
        "modo": "10var" if variant == "10var" else "lluvia",
        "parcelas_sin_referencia": sin_referencia,
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **context(i), **results[i]} for i in range(len(ids))
        ],
    }


def _predict_official_pro(content: bytes, conjunto: str, variant: str = "abierto"):
    """CSV PRO (Planet) oficial: lluvia abr–may de la tabla de referencia (modelo de lluvia) + índices Planet como contexto."""
    if variant == "10var":
        raise HTTPException(
            status_code=422,
            detail="Las 10 variables son índices de Sentinel-2/Landsat y el CSV PRO (Planet) no los trae. "
            "Sube el CSV Básico para usar las 10 variables, o elige el modo de solo lluvia.",
        )
    conjunto = conjunto.strip().upper()
    if conjunto not in ("PREDICCION", "ENTRENAMIENTO", "TODAS"):
        raise HTTPException(status_code=400, detail="conjunto debe ser PREDICCION, ENTRENAMIENTO o TODAS.")
    try:
        raw = pd.read_csv(
            io.BytesIO(content),
            encoding="utf-8-sig",
            usecols=lambda c: c in official.PLANET_USECOLS,
            dtype={"ID_POLIGONO": "string", "fecha_captura": "string", "sensor": "string"},
        )
        feats = official.planet_features(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el archivo de Planet: {e}")

    sin_referencia = int(feats["CONJUNTO"].isna().sum())
    if conjunto != "TODAS":
        feats = feats[(feats["CONJUNTO"] == conjunto) | feats["CONJUNTO"].isna()].reset_index(drop=True)
    if feats.empty:
        raise HTTPException(status_code=400, detail="El archivo no trae parcelas del conjunto pedido.")

    ids = feats["ID_POLIGONO"].tolist()
    estados = feats["Estado"].tolist()
    # El modelo con Planet no mejora a la lluvia sola (ver ml/README.md): el CSV PRO se ejecuta con el modelo de lluvia y
    # los índices de Planet se devuelven como contexto de la parcela.
    results = run_inference(feats.copy(), estados, variant)
    for r in results:
        r["modelo"] = "abierto"

    def context(i):
        extra = {k: _clean(feats[k].iloc[i]) for k in [*official.PLANET_FEATURES, "ndvi_pico_ciclo"]}
        return {**row_context(feats, i), **extra}

    return {
        "n_parcelas": len(feats),
        "fuente": "csv_pro_planet",
        "conjunto": conjunto,
        "modelo": "abierto",
        "modo": "10var" if variant == "10var" else "lluvia",
        "parcelas_sin_referencia": sin_referencia,
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **context(i), **results[i]} for i in range(len(ids))
        ],
    }
