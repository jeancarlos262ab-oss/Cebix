from __future__ import annotations

import math
import os
from datetime import date

PHENO_WINDOWS = {
    
    "emergencia_macollamiento": ("04-01", "06-01"),  
    "encanado": ("06-01", "08-01"),                  
    "espigado_llenado": ("08-01", "10-01"),          
}

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

CLOUD_MAX = 40          
FIRST_YEAR = 2018       
MAX_VERTICES = 500
MIN_AREA_HA = 0.05      
MAX_AREA_HA = float(os.environ.get("SAT_MAX_AREA_HA", "5000"))
WARN_AREA_HA = float(os.environ.get("AREA_WARN_HA", "1000"))  
QUEUE_TIMEOUT_S = float(os.environ.get("SAT_QUEUE_TIMEOUT_S", "5"))

MAX_MISSING = 3

class SatelliteError(Exception):
    

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

_R = 6371008.8

def _ring_area_ha(ring: list[list[float]]) -> float:
    
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
    if ha > MAX_AREA_HA:
        raise GeometryError(
            f"La parcela mide {ha:,.0f} ha y el máximo permitido es {MAX_AREA_HA:,.0f} ha. "
            "Con superficies así el promedio mezcla coberturas distintas y el servicio no alcanza a procesarlas."
        )
    return {"type": "Polygon", "coordinates": [ring]}, ha

def area_warning(ha: float | None) -> str | None:
    
    if ha is None or ha <= WARN_AREA_HA:
        return None
    return (
        f"La superficie es de {ha:,.0f} ha. No es recomendable una zona tan grande: el promedio mezcla cultivos y "
        "coberturas distintas (otros cultivos, monte, caminos, zonas urbanas) y la predicción deja de representar a "
        "una parcela. Es preferible calcular cada parcela por separado."
    )

N_OBS_TRAIN_MEAN = 54.17
N_OBS_TRAIN_STD = 8.65

def n_obs_warning(n_obs: float | None) -> str | None:
    
    if n_obs is None:
        return None
    lo = round(N_OBS_TRAIN_MEAN - 3 * N_OBS_TRAIN_STD)
    hi = round(N_OBS_TRAIN_MEAN + 3 * N_OBS_TRAIN_STD)
    if lo <= n_obs <= hi:
        return None
    side = "más alto" if n_obs > hi else "más bajo"
    cause = (
        "Suele pasar cuando la parcela cae en el traslape de dos órbitas de satélite (se observa más veces)."
        if n_obs > hi
        else "Suele pasar por mucha nubosidad o porque el año aún no termina."
    )
    return (
        f"El conteo de escenas ({int(n_obs)}) es {side} que el de las parcelas de entrenamiento (≈{lo}–{hi}, típico ≈54). "
        f"{cause} No es un error de ubicación; para el modelo equivale al extremo del rango que vio en el entrenamiento."
    )

def validate_year(year: int) -> int:
    last = date.today().year
    if not isinstance(year, int) or isinstance(year, bool) or year < FIRST_YEAR or year > last:
        raise GeometryError(f"El año debe estar entre {FIRST_YEAR} y {last}.")
    return year