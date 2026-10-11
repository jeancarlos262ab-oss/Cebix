"""
Piezas comunes del cálculo de features satelitales (las usa `stac.py` y `geo_service.py`)
========================================================================================

Contiene lo que no depende de la fuente de imágenes:
  * ventanas fenológicas y las 10 features que espera el modelo,
  * errores con su código HTTP,
  * validación y normalización del polígono (GeoJSON lng/lat) y del año.

La superficie NO tiene tope: una parcela grande se calcula igual, pero `area_warning()` devuelve un
aviso, porque el promedio de una zona extensa mezcla cultivos y coberturas distintas y la predicción
deja de representar a una parcela. El umbral del aviso se ajusta con AREA_WARN_HA (1000 ha por defecto).

Variables de entorno:
  AREA_WARN_HA        superficie (ha) a partir de la cual se advierte, 1000 por defecto
  SAT_QUEUE_TIMEOUT_S cuánto espera una petición su turno, 5 por defecto
"""

from __future__ import annotations

import math
import os
from datetime import date

# ─────────────────────────────── Configuración ───────────────────────────────

PHENO_WINDOWS = {
    # nombre: (inicio MM-DD, fin EXCLUSIVO MM-DD). filterDate excluye el día final.
    "emergencia_macollamiento": ("04-01", "06-01"),  # 1 abr – 31 may
    "encanado": ("06-01", "08-01"),                  # 1 jun – 31 jul
    "espigado_llenado": ("08-01", "10-01"),          # 1 ago – 30 sep
}

# feature del modelo -> (ventana, banda de índice)
S2_FEATURES = {
    "bas_lai_espigado_llenado": ("espigado_llenado", "lai"),
    "bas_ndti_emergencia_macollamiento": ("emergencia_macollamiento", "ndti"),
    "bas_sti_encanado": ("encanado", "sti"),
    "bas_ndvi_emergencia_macollamiento": ("emergencia_macollamiento", "ndvi"),
    "bas_ndwi_espigado_llenado": ("espigado_llenado", "ndwi"),
    "bas_ndti_encanado": ("encanado", "ndti"),
    "bas_evi_emergencia_macollamiento": ("emergencia_macollamiento", "evi"),
    "bas_evi_encanado": ("encanado", "evi"),
}

FEATURE_KEYS = [
    "precip_acum_emergencia_macollamiento_mm",
    "bas_n_obs_ciclo",
    *S2_FEATURES.keys(),
]

CLOUD_MAX = 40          # % de nubes, mismo umbral que build_features.py
FIRST_YEAR = 2018       # Sentinel-2 SR global arranca a finales de 2018
MAX_VERTICES = 500
MIN_AREA_HA = 0.05      # por debajo no hay ni 5 píxeles de 10 m
WARN_AREA_HA = float(os.environ.get("AREA_WARN_HA", "1000"))  # solo advierte; no hay tope
QUEUE_TIMEOUT_S = float(os.environ.get("SAT_QUEUE_TIMEOUT_S", "5"))
# Si faltan más de estas features el resultado no es confiable y se rechaza.
MAX_MISSING = 3


# ─────────────────────────────── Errores ───────────────────────────────


class SatelliteError(Exception):
    """Base. `status` es el código HTTP que debe responder el endpoint."""

    status = 502

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class SatelliteNotConfigured(SatelliteError):
    status = 503


class GeometryError(SatelliteError):
    status = 422


class SatelliteBusy(SatelliteError):
    status = 429


class SatelliteNoData(SatelliteError):
    status = 422


# ─────────────────────────────── Geometría (sin dependencias) ───────────────────────────────

_R = 6371008.8


def _ring_area_ha(ring: list[list[float]]) -> float:
    """Área geodésica aproximada (ha) de un anillo [[lng, lat], ...] (abierto o cerrado)."""
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    total = 0.0
    n = len(pts)
    for i in range(n):
        lng1, lat1 = pts[i]
        lng2, lat2 = pts[(i + 1) % n]
        total += math.radians(lng2 - lng1) * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(total * _R * _R / 2) / 10_000


def _orient(p, q, r) -> float:
    return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])


def _segments_cross(a, b, c, d) -> bool:
    o1, o2, o3, o4 = _orient(a, b, c), _orient(a, b, d), _orient(c, d, a), _orient(c, d, b)
    return o1 * o2 < 0 and o3 * o4 < 0


def _self_intersects(pts: list[list[float]]) -> bool:
    n = len(pts)
    for i in range(n):
        for j in range(i + 1, n):
            if abs(i - j) == 1 or (i == 0 and j == n - 1):
                continue
            if _segments_cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]):
                return True
    return False


def validate_geometry(geometry: dict) -> tuple[dict, float]:
    """
    Valida el GeoJSON y lo normaliza a un Polygon de un solo anillo, cerrado.
    Devuelve (geometría, hectáreas). Lanza GeometryError con un mensaje legible.
    """
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise GeometryError("La geometría debe ser un GeoJSON de tipo Polygon.")
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or not coords or not isinstance(coords[0], list):
        raise GeometryError("El Polygon no trae coordenadas.")
    if len(coords) > 1:
        raise GeometryError("Por ahora no se aceptan polígonos con huecos; manda solo el contorno exterior.")

    try:
        ring = [[float(x), float(y)] for x, y, *_ in coords[0]]
    except (TypeError, ValueError):
        raise GeometryError("Las coordenadas deben ser pares numéricos [lng, lat].") from None

    if any(not (math.isfinite(x) and math.isfinite(y)) for x, y in ring):
        raise GeometryError("Hay coordenadas no válidas (NaN o infinito).")
    if any(abs(x) > 180 or abs(y) > 90 for x, y in ring):
        raise GeometryError("Las coordenadas no están en lng/lat (EPSG:4326). ¿Vienen en UTM?")

    if ring[0] != ring[-1]:
        ring.append(ring[0])
    if len(ring) < 4:
        raise GeometryError("El polígono necesita al menos 3 vértices distintos.")
    if len(ring) - 1 > MAX_VERTICES:
        raise GeometryError(f"Demasiados vértices ({len(ring) - 1}); el máximo es {MAX_VERTICES}.")
    if _self_intersects(ring[:-1]):
        raise GeometryError("El contorno se cruza consigo mismo. Corrígelo y vuelve a intentar.")

    ha = _ring_area_ha(ring)
    if ha < MIN_AREA_HA:
        raise GeometryError(f"La parcela es demasiado pequeña ({ha:.3f} ha) para promediar píxeles de 10 m.")
    return {"type": "Polygon", "coordinates": [ring]}, ha


def area_warning(ha: float | None) -> str | None:
    """Aviso (no error) cuando la superficie es tan grande que mezcla coberturas distintas."""
    if ha is None or ha <= WARN_AREA_HA:
        return None
    return (
        f"La superficie es de {ha:,.0f} ha. No es recomendable una zona tan grande: el promedio mezcla cultivos y "
        "coberturas distintas (otros cultivos, monte, caminos, zonas urbanas) y la predicción deja de representar a "
        "una parcela. Es preferible calcular cada parcela por separado."
    )


def validate_year(year: int) -> int:
    last = date.today().year
    if not isinstance(year, int) or isinstance(year, bool) or year < FIRST_YEAR or year > last:
        raise GeometryError(f"El año debe estar entre {FIRST_YEAR} y {last}.")
    return year
