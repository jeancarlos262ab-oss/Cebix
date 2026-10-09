"""Predicción sobre features ya calculadas (JSON o CSV)."""

import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import PredictRequest
from app.services.model_service import row_context, run_inference

router = APIRouter(tags=["predicción"])


@router.post("/predict")
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
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **row_context(meta_df, i), **results[i]}
            for i in range(len(ids))
        ]
    }


@router.post("/predict-csv")
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
            {"ID_POLIGONO": ids[i], "Estado": estados[i], **row_context(df, i), **results[i]}
            for i in range(len(ids))
        ],
    }
