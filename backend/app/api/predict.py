import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.schemas import PredictRequest
from app.services import official_dataset as official
from app.services.features.common import FEATURE_KEYS, PRECIP_ETAPAS_KEYS
from app.services.model_service import _clean, modo_from_variant, row_context, run_inference, variant_from_modo

router = APIRouter(tags=["predicción"])

@router.post("/predict")
def predict(payload: PredictRequest, modo: str = Query("lluvia", description="'lluvia' (por defecto), '10var' (Plan B), 'ciclo' (lluvia de las 3 etapas abr–oct) o '10var_ciclo' (10 variables con la lluvia de las 3 etapas).")):
    if not payload.parcelas:
        raise HTTPException(status_code=400, detail="Manda al menos una parcela en 'parcelas'.")

    rows = [p.features for p in payload.parcelas]
    ids = [p.ID_POLIGONO for p in payload.parcelas]
    estados = [p.Estado for p in payload.parcelas]

    df = pd.DataFrame(rows)
    meta_df = df.copy()  
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
    modo: str = Query("lluvia", description="'lluvia' (solo la lluvia de abril–mayo, por defecto), '10var' (Plan B: 10 variables), 'ciclo' (lluvia de las 3 etapas, abril–octubre) o '10var_ciclo' (10 variables con la lluvia de las 3 etapas)."),
):
    
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
        
        feats = feats[(feats["CONJUNTO"] == conjunto) | feats["CONJUNTO"].isna()].reset_index(drop=True)
    if feats.empty:
        raise HTTPException(status_code=400, detail="El archivo no trae parcelas del conjunto pedido.")

    ids = feats["ID_POLIGONO"].tolist()
    estados = feats["Estado"].tolist()
    results = run_inference(feats.copy(), estados, variant)
    for r in results:
        r["modelo"] = "abierto"

    def context(i):
        extra = {k: _clean(feats[k].iloc[i]) for k in [*FEATURE_KEYS, *PRECIP_ETAPAS_KEYS, "ndvi_pico_ciclo"] if k in feats.columns}
        return {**row_context(feats, i), **extra}

    return {
        "n_parcelas": len(feats),
        "fuente": "csv_basico_oficial",
        "conjunto": conjunto,
        "modelo": "abierto",
        "modo": modo_from_variant(variant),
        "parcelas_sin_referencia": sin_referencia,
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **context(i), **results[i]} for i in range(len(ids))
        ],
    }

def _predict_official_pro(content: bytes, conjunto: str, variant: str = "abierto"):
    
    if variant in ("10var", "10var_ciclo"):
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
    
    
    results = run_inference(feats.copy(), estados, variant)
    for r in results:
        r["modelo"] = "abierto"

    def context(i):
        extra = {k: _clean(feats[k].iloc[i]) for k in [*official.PLANET_FEATURES, *PRECIP_ETAPAS_KEYS, "ndvi_pico_ciclo"] if k in feats.columns}
        return {**row_context(feats, i), **extra}

    return {
        "n_parcelas": len(feats),
        "fuente": "csv_pro_planet",
        "conjunto": conjunto,
        "modelo": "abierto",
        "modo": modo_from_variant(variant),
        "parcelas_sin_referencia": sin_referencia,
        "predicciones": [
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **context(i), **results[i]} for i in range(len(ids))
        ],
    }