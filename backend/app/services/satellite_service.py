"""Elige el proveedor de features satelitales (STAC abierto por defecto, o Earth Engine)."""

from app.config import FEATURES_PROVIDER
from app.services.features import gee, stac


def provider() -> str:
    p = FEATURES_PROVIDER.strip().lower()
    return p if p in ("stac", "gee") else "stac"


def extract(geometry: dict, year: int) -> dict:
    if provider() == "gee":
        return gee.extract_features_gee(geometry, year)
    return stac.extract_features_stac(geometry, year)


def status() -> dict:
    """Diagnóstico sin tocar la red: proveedor activo y si sus librerías/credenciales están listas."""
    if provider() == "gee":
        return {"provider": "gee", "ready": gee.configured(), **gee.status()}
    return stac.status()
