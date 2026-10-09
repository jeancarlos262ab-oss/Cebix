"""Estado del servicio."""

from fastapi import APIRouter

from app.services.model_service import get_artifact

router = APIRouter(tags=["estado"])


@router.get("/health")
def health():
    # Ligero: no carga el modelo. Es el health check de Render.
    return {"status": "ok"}


@router.get("/")
def root():
    artifact, _ = get_artifact()
    return {
        "status": "ok",
        "modelo": artifact["model_name"],
        "n_features": len(artifact["feature_order"]),
        "rmse_global_leave_region_out": round(artifact["overall_rmse"], 3),
        "mensaje": "Backend de inferencia REAL. Cada llamada a /predict corre el modelo, no devuelve datos precalculados.",
    }
