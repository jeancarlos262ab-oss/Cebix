import io
import re

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.model_service import run_inference, variant_from_modo
from app.config import PARCELAS_OFICIALES_PATH

router = APIRouter(tags=["resumen"])

EXPECTED_N_PREDICT = 59
YIELD_SANITY_MAX = 15.0   

MODOS_ENTREGA = ("lluvia", "ciclo")

def build_submission(modo: str = "lluvia") -> pd.DataFrame:
    
    if modo not in MODOS_ENTREGA:
        raise HTTPException(
            status_code=422,
            detail="La entrega se genera con «Solo lluvia» (el mejor modelo) o «Ciclo completo». "
            "Los modos de 10 variables necesitan los índices satelitales de cada parcela.",
        )
    ref = pd.read_csv(PARCELAS_OFICIALES_PATH)
    ref["ID_POLIGONO"] = ref["ID_POLIGONO"].astype(str).str.strip()
    pred = ref[ref["CONJUNTO"].astype(str).str.upper() == "PREDICCION"].reset_index(drop=True)
    if len(pred) != EXPECTED_N_PREDICT:
        raise HTTPException(status_code=500, detail=f"La tabla oficial trae {len(pred)} parcelas de PREDICCION y se esperaban {EXPECTED_N_PREDICT}.")

    results = run_inference(pred.copy(), pred["Estado"].tolist(), variant_from_modo(modo))
    out = pd.DataFrame({
        "ID_POLIGONO": pred["ID_POLIGONO"],
        "AREA_HA": pred["area_ha"],
        "RENDIMIENTO_T_HA": [round(float(r["yieldEstimate"]), 2) for r in results],
        "CONJUNTO": pred["CONJUNTO"],
    }).sort_values("ID_POLIGONO").reset_index(drop=True)

    problems = []
    if out["RENDIMIENTO_T_HA"].isna().any():
        problems.append("hay predicciones vacías")
    if (out["RENDIMIENTO_T_HA"] < 0).any():
        problems.append("hay predicciones negativas")
    if (out["RENDIMIENTO_T_HA"] > YIELD_SANITY_MAX).any():
        problems.append(f"hay predicciones mayores a {YIELD_SANITY_MAX} t/ha (revisa unidades)")
    if out["ID_POLIGONO"].duplicated().any():
        problems.append("hay ID_POLIGONO repetidos")
    if problems:
        raise HTTPException(status_code=500, detail="No se generó el archivo de entrega: " + "; ".join(problems) + ".")
    return out

def _safe_name(nombre: str) -> str:
    t = re.sub(r"[^a-z0-9_-]+", "_", nombre.strip().lower()).strip("_")
    if not t:
        raise HTTPException(status_code=422, detail="Escribe un nombre para el archivo (letras, números, guion o guion bajo).")
    return t[:60]

@router.get("/submission-csv")
def submission_csv(
    nombre: str = Query(..., description="Nombre para el archivo; se descarga como <nombre>_prediccion.csv."),
    modo: str = Query("lluvia", description="'lluvia' (por defecto, el mejor modelo) o 'ciclo'."),
):
    
    name = f"{_safe_name(nombre)}_prediccion.csv"
    buf = io.StringIO()
    build_submission(modo).to_csv(buf, index=False)
    return Response(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}"', "Access-Control-Expose-Headers": "Content-Disposition"},
    )