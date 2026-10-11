"""Proveedor de features satelitales: fuentes abiertas (Sentinel-2 / Landsat vía STAC y CHIRPS)."""

from app.services.features import stac


def provider() -> str:
    return "stac"


def extract(geometry: dict, year: int) -> dict:
    return stac.extract_features_stac(geometry, year)


def status() -> dict:
    """Diagnóstico sin tocar la red: si sus librerías están listas."""
    return stac.status()
