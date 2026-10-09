"""
Extracción de las 10 features del modelo desde Google Earth Engine (GEE)
========================================================================

Implementa ml/GUIA_GOOGLE_EARTH_ENGINE.md: recibe un polígono GeoJSON (lat/lng, EPSG:4326)
y un año, y devuelve el diccionario de las 10 features que espera el modelo.

Fuentes (todas gratuitas): Sentinel-2 SR (COPERNICUS/S2_SR_HARMONIZED), CHIRPS diario y el
conteo de escenas Sentinel-2 + Landsat 8/9.

Método (igual que el dataset oficial): por cada escena se promedia el índice dentro del
polígono y, entre las escenas de cada ventana fenológica, se toma la MEDIANA. No es un
compuesto mediano por píxel.

Diferencias con la guía, a propósito:
  * En vez de ~10 .getInfo() se hacen 5 (una por ventana fenológica, más lluvia y conteo de
    escenas): las bandas de una misma ventana se piden juntas. El resultado es el mismo.
  * Credenciales por variable de entorno (sin archivo en el repo): ver `configured()`.

Variables de entorno:
  GEE_SERVICE_ACCOUNT_JSON   contenido COMPLETO del JSON de la cuenta de servicio (secreto), o
  GEE_SERVICE_ACCOUNT_FILE   ruta a ese JSON (para correr en local; el archivo va en .gitignore)
  GEE_PROJECT                (opcional) Project ID de Cloud; si falta se usa el del JSON
  GEE_MAX_AREA_HA            (opcional) superficie máxima aceptada, 5000 por defecto
  GEE_QUEUE_TIMEOUT_S        (opcional) cuánto espera una petición su turno, 5 por defecto

Este módulo no importa `ee` al cargarse: el backend arranca igual sin earthengine-api ni
credenciales, y /predict-from-geometry responde 503 explicando qué falta.
"""

from __future__ import annotations

import json
import math
import os
import threading
import time
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
MAX_AREA_HA = float(os.environ.get("GEE_MAX_AREA_HA", "5000"))
QUEUE_TIMEOUT_S = float(os.environ.get("GEE_QUEUE_TIMEOUT_S", "5"))
RETRIES = 2

# Si faltan más de estas features el resultado no es confiable y se rechaza.
MAX_MISSING = 3


# ─────────────────────────────── Errores ───────────────────────────────


class GeeError(Exception):
    """Base. `status` es el código HTTP que debe responder el endpoint."""

    status = 502

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class GeeNotConfigured(GeeError):
    status = 503


class GeometryError(GeeError):
    status = 422


class GeeBusy(GeeError):
    status = 429


class GeeNoData(GeeError):
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
    if ha > MAX_AREA_HA:
        raise GeometryError(
            f"La parcela mide {ha:,.0f} ha y el máximo permitido es {MAX_AREA_HA:,.0f} ha. "
            "Con superficies así el promedio mezcla coberturas distintas y se agotan las cuotas de Earth Engine."
        )
    return {"type": "Polygon", "coordinates": [ring]}, ha


def validate_year(year: int) -> int:
    last = date.today().year
    if not isinstance(year, int) or isinstance(year, bool) or year < FIRST_YEAR or year > last:
        raise GeometryError(f"El año debe estar entre {FIRST_YEAR} y {last}.")
    return year


# ─────────────────────────────── Autenticación ───────────────────────────────

_init_lock = threading.Lock()
_initialized = False
# Un solo cálculo a la vez: el plan gratuito de GEE limita las peticiones concurrentes.
_run_lock = threading.Lock()


def _credentials_source() -> tuple[str, str] | None:
    raw = os.environ.get("GEE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        return "json", raw
    path = os.environ.get("GEE_SERVICE_ACCOUNT_FILE", "").strip()
    if path:
        return "file", path
    return None


def configured() -> bool:
    """¿Hay credenciales declaradas? No hace red ni importa `ee`."""
    return _credentials_source() is not None


def status() -> dict:
    return {"configured": configured(), "initialized": _initialized, "max_area_ha": MAX_AREA_HA}


def _import_ee():
    try:
        import ee  # noqa: PLC0415

        return ee
    except ImportError:
        raise GeeNotConfigured(
            "Falta la librería earthengine-api en el servidor (pip install earthengine-api)."
        ) from None


def ensure_initialized():
    """Autentica con la cuenta de servicio una sola vez por proceso. Devuelve el módulo `ee`."""
    global _initialized
    ee = _import_ee()
    if _initialized:
        return ee
    with _init_lock:
        if _initialized:
            return ee
        src = _credentials_source()
        if src is None:
            raise GeeNotConfigured(
                "Earth Engine no está configurado en el servidor. Define GEE_SERVICE_ACCOUNT_JSON "
                "(o GEE_SERVICE_ACCOUNT_FILE) con la clave de la cuenta de servicio."
            )
        kind, value = src
        try:
            if kind == "json":
                info = json.loads(value)
                key_data = value
            else:
                with open(value, encoding="utf-8") as f:
                    key_data = f.read()
                info = json.loads(key_data)
            email = info["client_email"]
            project = os.environ.get("GEE_PROJECT", "").strip() or info.get("project_id")
            credentials = ee.ServiceAccountCredentials(email, key_data=key_data)
            ee.Initialize(credentials, project=project)
        except (OSError, ValueError, KeyError) as e:
            raise GeeNotConfigured(f"La clave de la cuenta de servicio no es válida o no se pudo leer ({type(e).__name__}).") from None
        except Exception as e:  # noqa: BLE001 — ee lanza EEException u errores de google-auth
            raise GeeNotConfigured(
                "No se pudo autenticar con Earth Engine. Revisa que el proyecto de Cloud esté activo, que la cuenta de "
                f"servicio esté registrada en Earth Engine y que la clave no se haya revocado. Detalle: {_short(e)}"
            ) from None
        _initialized = True
        return ee


def _short(e: Exception, n: int = 220) -> str:
    s = " ".join(str(e).split())
    return s if len(s) <= n else s[: n - 1] + "…"


# ─────────────────────────────── Cálculo en GEE ───────────────────────────────


def _add_indices(ee, image):
    """Fórmulas oficiales del PDF de FIRA (Paso 4 de la guía)."""
    img = image.divide(10000)
    B2, B4, B8 = img.select("B2"), img.select("B4"), img.select("B8")
    B11, B12 = img.select("B11"), img.select("B12")

    ndvi = B8.subtract(B4).divide(B8.add(B4)).rename("ndvi")
    evi = B8.subtract(B4).divide(B8.add(B4.multiply(6)).subtract(B2.multiply(7.5)).add(1)).multiply(2.5).rename("evi")
    savi = B8.subtract(B4).multiply(1.5).divide(B8.add(B4).add(0.5))
    # LAI = -ln((0.69 - SAVI) / 0.59) / 0.91 ; con SAVI >= 0.69 da NaN y esa escena no aporta.
    lai = savi.multiply(-1).add(0.69).divide(0.59).log().multiply(-1).divide(0.91).rename("lai")
    ndwi = B8.subtract(B11).divide(B8.add(B11)).rename("ndwi")
    ndti = B11.subtract(B12).divide(B11.add(B12)).rename("ndti")
    sti = B11.divide(B12).rename("sti")
    return image.addBands([ndvi, evi, lai, ndwi, ndti, sti])


def _s2_window_medians(ee, geom, year: int, window: str, bands: list[str]) -> dict:
    """Mediana, entre las escenas de la ventana, del promedio del polígono de cada banda."""
    start_md, end_md = PHENO_WINDOWS[window]
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate(f"{year}-{start_md}", f"{year}-{end_md}")
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", CLOUD_MAX))
        .map(lambda im: _add_indices(ee, im).select(bands))
    )

    def per_image(img):
        means = img.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=10, maxPixels=1e9)
        return ee.Feature(None, means)

    fc = ee.FeatureCollection(col.map(per_image))
    out = {}
    for b in bands:
        arr = fc.filter(ee.Filter.notNull([b])).aggregate_array(b)
        out[b] = ee.Algorithms.If(arr.size().gt(0), arr.reduce(ee.Reducer.median()), None)
    n_scenes = col.size()
    return ee.Dictionary({"medianas": ee.Dictionary(out), "n_escenas": n_scenes}).getInfo()


def _precip(ee, geom, year: int) -> float | None:
    start_md, end_md = PHENO_WINDOWS["emergencia_macollamiento"]
    total = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(f"{year}-{start_md}", f"{year}-{end_md}").sum()

    def reduce_over(g):
        return total.reduceRegion(ee.Reducer.mean(), g, scale=5566, maxPixels=1e9).get("precipitation").getInfo()

    value = reduce_over(geom)
    if value is None:  # parcela más chica que un píxel de CHIRPS (~5.5 km): se usa el centroide
        value = reduce_over(geom.centroid(1))
    return value


def _n_obs(ee, geom, year: int) -> int:
    """Fechas distintas con escena Sentinel-2 o Landsat 8/9 (nubes <= 40 %), 1 abr – 31 oct."""
    start, end = f"{year}-04-01", f"{year}-11-01"

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate(start, end)
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", CLOUD_MAX))
    )

    def landsat(col_id):
        return (
            ee.ImageCollection(col_id)
            .filterBounds(geom)
            .filterDate(start, end)
            .filter(ee.Filter.lte("CLOUD_COVER", CLOUD_MAX))
        )

    ls = landsat("LANDSAT/LC08/C02/T1_L2").merge(landsat("LANDSAT/LC09/C02/T1_L2"))

    def n_dates(col):
        return col.aggregate_array("system:time_start").map(lambda t: ee.Date(t).format("YYYY-MM-dd")).distinct().size()

    res = ee.Dictionary({"s2": n_dates(s2), "ls": n_dates(ls)}).getInfo()
    return int(res["s2"]) + int(res["ls"])


def _with_retries(fn, *args):
    """Reintenta errores transitorios de GEE (cuota concurrente, timeouts) con espera creciente."""
    last = None
    for attempt in range(RETRIES + 1):
        try:
            return fn(*args)
        except Exception as e:  # noqa: BLE001
            msg = str(e).lower()
            transient = any(k in msg for k in ("too many", "429", "quota", "timed out", "timeout", "unavailable", "503", "internal error", "deadline"))
            last = e
            if not transient or attempt == RETRIES:
                break
            time.sleep(1.5 * (attempt + 1))
    raise GeeError(f"Earth Engine no pudo completar el cálculo: {_short(last)}") from None


def extract_features_gee(geometry_geojson: dict, year: int = 2025) -> dict:
    """
    Calcula las 10 features del modelo para un polígono. Bloqueante (~15–30 s).

    Devuelve {"features": {...10 claves...}, "advertencias": [...], "area_ha": float}.
    Una feature sin escenas válidas viene como None (el imputer del modelo la rellena con la
    mediana de entrenamiento) y se avisa en `advertencias`; si faltan más de MAX_MISSING se
    lanza GeeNoData porque la predicción ya no sería confiable.
    """
    geometry, area_ha = validate_geometry(geometry_geojson)
    year = validate_year(year)

    if not _run_lock.acquire(timeout=QUEUE_TIMEOUT_S):
        raise GeeBusy("Hay otro cálculo de Earth Engine en curso. Espera unos segundos y reintenta.")
    try:
        ee = ensure_initialized()
        geom = ee.Geometry(geometry)

        features: dict[str, float | int | None] = {}
        warnings: list[str] = []

        features["precip_acum_emergencia_macollamiento_mm"] = _with_retries(_precip, ee, geom, year)

        # Una consulta por ventana, con todas las bandas que esa ventana necesita.
        by_window: dict[str, list[str]] = {}
        for _, (window, band) in S2_FEATURES.items():
            by_window.setdefault(window, [])
            if band not in by_window[window]:
                by_window[window].append(band)

        scenes_per_window = {}
        for window, bands in by_window.items():
            res = _with_retries(_s2_window_medians, ee, geom, year, window, bands)
            scenes_per_window[window] = int(res["n_escenas"])
            for key, (w, band) in S2_FEATURES.items():
                if w == window:
                    features[key] = res["medianas"].get(band)

        features["bas_n_obs_ciclo"] = _with_retries(_n_obs, ee, geom, year)
    finally:
        _run_lock.release()

    # Reordena como lo espera el modelo y limpia valores no finitos.
    ordered = {}
    for k in FEATURE_KEYS:
        v = features.get(k)
        ordered[k] = None if v is None or (isinstance(v, float) and not math.isfinite(v)) else v

    missing = [k for k, v in ordered.items() if v is None]
    if len(missing) > MAX_MISSING:
        raise GeeNoData(
            f"Earth Engine devolvió datos para solo {len(FEATURE_KEYS) - len(missing)} de {len(FEATURE_KEYS)} variables "
            f"en {year}. Suele pasar si las escenas están muy nubladas o el año aún no tiene datos en esa ventana."
        )
    for k in missing:
        warnings.append(f"Sin escenas válidas para «{k}»: el modelo usó la mediana de entrenamiento.")
    for window, n in scenes_per_window.items():
        if n < 3:
            warnings.append(f"Solo {n} escena(s) de Sentinel-2 en la ventana {window}: la mediana es poco representativa.")
    n_obs = ordered.get("bas_n_obs_ciclo")
    if n_obs is not None and not (25 <= n_obs <= 90):
        warnings.append(f"El conteo de escenas ({n_obs}) está lejos de las ≈54 del dataset oficial; revisa la ubicación.")

    return {"features": ordered, "advertencias": warnings, "area_ha": round(area_ha, 3)}
