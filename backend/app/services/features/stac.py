"""
Extracción de las 10 features del modelo SIN cuentas, tarjetas ni cuotas
=========================================================================

Alternativa 100 % gratuita a Google Earth Engine. Todas las fuentes son abiertas y se leen
de forma anónima:

  * Sentinel-2 L2A y Landsat 8/9 -> catálogo STAC «Earth Search» (Element 84) sobre el
    Registro de Datos Abiertos de AWS. Las imágenes son Cloud-Optimized GeoTIFF: solo se
    descarga el recorte de la parcela (unos KB por banda), no la escena entera.
  * Lluvia -> CHIRPS v2.0 diario (Climate Hazards Center, UCSB), también COG anónimo.

Método (igual que el dataset oficial y que gee.py): por cada escena se promedia el
índice dentro del polígono y, entre las escenas de cada ventana fenológica, se toma la mediana.

Diferencias a conocer frente a Earth Engine (por eso hay que correr scripts/validate_gee.py):
  * Un píxel con valor no finito (p. ej. LAI con SAVI >= 0.69) se descarta píxel a píxel; en
    Earth Engine la guía dice que esa escena «no aporta». Puede mover un poco el LAI.
  * Píxel dentro del polígono = su centro cae dentro (Earth Engine pondera por fracción cubierta).
    En 10 m la diferencia es mínima; en CHIRPS (5.5 km) sí se pondera por fracción cubierta.
  * Es más lento: ~30–90 s por parcela (muchas lecturas HTTP pequeñas), según la red.

Variables de entorno opcionales:
  STAC_API_URL           https://earth-search.aws.element84.com/v1
  STAC_S2_COLLECTION     sentinel-2-l2a
  STAC_LS_COLLECTION     landsat-c2-l2
  CHIRPS_URL_TEMPLATE    https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/cogs/p05/{year}/chirps-v2.0.{year}.{month:02d}.{day:02d}.cog
  STAC_WORKERS           lecturas en paralelo (6 por defecto; sube la memoria usada)

Importante: la ruta de CHIRPS y los nombres de las colecciones son los publicados al escribir
esto; si el servicio los cambia, basta con ajustar estas variables, sin tocar el código.
"""

from __future__ import annotations

import os
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np

from app.services.features.gee import (
    CLOUD_MAX,
    FEATURE_KEYS,
    MAX_MISSING,
    PHENO_WINDOWS,
    QUEUE_TIMEOUT_S,
    S2_FEATURES,
    GeeBusy,
    GeeError,
    GeeNoData,
    validate_geometry,
    validate_year,
)

# ─────────────────────────────── Configuración ───────────────────────────────

STAC_API_URL = os.environ.get("STAC_API_URL", "https://earth-search.aws.element84.com/v1")
S2_COLLECTION = os.environ.get("STAC_S2_COLLECTION", "sentinel-2-l2a")
LS_COLLECTION = os.environ.get("STAC_LS_COLLECTION", "landsat-c2-l2")
CHIRPS_URL_TEMPLATE = os.environ.get(
    "CHIRPS_URL_TEMPLATE",
    "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/cogs/p05/{year}/chirps-v2.0.{year}.{month:02d}.{day:02d}.cog",
)
WORKERS = max(1, int(os.environ.get("STAC_WORKERS", "6")))
READ_TRIES = 3
SUPERSAMPLE = 20  # submuestreo para ponderar CHIRPS por fracción de píxel cubierta

# Mes -> ventana fenológica (abr–may / jun–jul / ago–sep). Ver PHENO_WINDOWS.
WINDOW_OF_MONTH = {4: "emergencia_macollamiento", 5: "emergencia_macollamiento", 6: "encanado", 7: "encanado", 8: "espigado_llenado", 9: "espigado_llenado"}

S2_BANDS = {"blue": "B2", "red": "B4", "nir": "B8", "swir16": "B11", "swir22": "B12"}

# GDAL: lectura anónima y rápida de COG por HTTP. Se fija en el entorno antes de abrir nada.
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF,.tiff,.cog,.COG")
os.environ.setdefault("GDAL_HTTP_TIMEOUT", "30")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "3")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "1")
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
try:  # certificados para https dentro de contenedores mínimos
    import certifi

    os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())
except ImportError:
    pass

_run_lock = threading.Lock()


# ─────────────────────────────── Utilidades ───────────────────────────────


def status() -> dict:
    """Diagnóstico sin tocar la red: ¿se pueden importar las librerías? Si no, dice por qué."""
    import sys

    problems = {}
    for mod, pkg in (("rasterio", "rasterio"), ("pystac_client", "pystac-client")):
        try:
            __import__(mod)
        except ImportError as e:
            # «No module named» = no instalado; cualquier otro texto = instalado pero roto (p. ej. falta una DLL de GDAL)
            problems[pkg] = {"instalado": "No module named" not in str(e), "detalle": " ".join(str(e).split())[:200]}
    return {
        "provider": "stac",
        "ready": not problems,
        "missing_packages": list(problems),
        "problems": problems,
        "python": sys.version.split()[0],
        "executable": sys.executable,
        "stac_api": STAC_API_URL,
    }


def _require_libs():
    st = status()
    if not st["ready"]:
        from app.services.features.gee import GeeNotConfigured

        detail = "; ".join(f"{p}: {'instalado pero falla al cargar (' + i['detalle'] + ')' if i['instalado'] else 'no instalado'}" for p, i in st["problems"].items())
        if any(i["instalado"] and "shared object" in i["detalle"] for i in st["problems"].values()):
            # Python sí está instalado; lo que falta es una librería del SISTEMA (típico de imágenes Docker mínimas).
            fix = "Falta una librería del sistema operativo, no de Python: en Docker/Debian instala libexpat1 (apt-get install -y libexpat1) y vuelve a construir la imagen."
        else:
            fix = f"Con el entorno que ejecuta uvicorn (Python {st['python']}) corre: python -m pip install -r requirements.txt y reinicia el servidor."
        raise GeeNotConfigured(f"Faltan librerías en el servidor ({detail}). {fix} Detalle en /satellite-status.")


def _retry(fn, *args, tries: int = READ_TRIES):
    last = None
    for attempt in range(tries):
        try:
            return fn(*args)
        except Exception as e:  # noqa: BLE001 — red, 404 transitorios, timeouts
            last = e
            if attempt < tries - 1:
                time.sleep(0.8 * (attempt + 1))
    raise last


def _short(e: Exception, n: int = 200) -> str:
    s = " ".join(str(e).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def _utc_day(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date()


# ─────────────────────────────── Sentinel-2: un recorte por escena ───────────────────────────────


def _asset_ref(item, key: str) -> tuple[str, float, float]:
    """(href, escala, offset) de una banda. Con baseline >= 04.00 la reflectancia lleva offset -0.1:
    es lo mismo que hace «HARMONIZED» en Earth Engine para que todo el archivo sea comparable."""
    asset = item.assets.get(key)
    if asset is None:
        raise KeyError(f"La escena {item.id} no trae la banda «{key}».")
    rb = (asset.extra_fields.get("raster:bands") or [{}])[0]
    scale = rb.get("scale")
    offset = rb.get("offset")
    if scale is None:
        scale = 1e-4
    if offset is None:
        try:
            offset = -0.1 if float(str(item.properties.get("s2:processing_baseline", "0"))) >= 4.0 else 0.0
        except ValueError:
            offset = 0.0
    return asset.href, float(scale), float(offset)


def _indices(refl: dict[str, np.ndarray], valid: np.ndarray) -> dict[str, float | None]:
    """Fórmulas oficiales (Paso 4 de la guía) y promedio dentro del polígono."""
    B2, B4, B8, B11, B12 = (refl[k] for k in ("blue", "red", "nir", "swir16", "swir22"))
    with np.errstate(all="ignore"):
        ndvi = (B8 - B4) / (B8 + B4)
        evi = 2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)
        savi = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)
        lai = -np.log((0.69 - savi) / 0.59) / 0.91
        ndwi = (B8 - B11) / (B8 + B11)
        ndti = (B11 - B12) / (B11 + B12)
        sti = B11 / B12
    out: dict[str, float | None] = {}
    for name, arr in (("ndvi", ndvi), ("evi", evi), ("lai", lai), ("ndwi", ndwi), ("ndti", ndti), ("sti", sti)):
        v = arr[valid]
        v = v[np.isfinite(v)]
        out[name] = float(v.mean()) if v.size else None
    return out


def _scene_means(refs: dict[str, tuple[str, float, float]], geom: dict) -> dict[str, float | None] | None:
    """
    Promedio del polígono de cada índice en UNA escena, leyendo solo el recorte de la parcela.
    `refs`: banda -> (href, escala, offset). Devuelve None si el polígono no toca datos válidos.
    """
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.errors import WindowError
    from rasterio.features import geometry_mask, geometry_window
    from rasterio.warp import transform_geom
    from rasterio.windows import bounds as win_bounds
    from rasterio.windows import from_bounds

    with rasterio.Env():
        with rasterio.open(refs["red"][0]) as red:
            g = transform_geom("EPSG:4326", red.crs, geom)
            try:
                win = geometry_window(red, [g])
            except WindowError:
                return None  # el polígono cae fuera de esta escena
            h, w = int(win.height), int(win.width)
            if h == 0 or w == 0:
                return None
            inside = geometry_mask([g], out_shape=(h, w), transform=red.window_transform(win), invert=True)
            bounds = win_bounds(win, red.transform)
            dn = {"red": red.read(1, window=win)}

        for key in ("blue", "nir", "swir16", "swir22"):
            with rasterio.open(refs[key][0]) as src:
                # SWIR viene a 20 m: se lleva a la malla de 10 m del recorte (vecino más cercano,
                # igual que Earth Engine con scale=10).
                dn[key] = src.read(
                    1,
                    window=from_bounds(*bounds, transform=src.transform),
                    out_shape=(h, w),
                    resampling=Resampling.nearest,
                )

    valid = inside.copy()
    refl = {}
    for key, arr in dn.items():
        valid &= arr > 0  # 0 = sin dato
        _, scale, offset = refs[key]
        refl[key] = np.maximum(arr.astype("float32") * scale + offset, 0.0)
    if not valid.any():
        return None
    return _indices(refl, valid)


def _dedupe(items: list) -> list:
    """Misma tile y fecha reprocesada (sufijo _0, _1…): se conserva la versión más reciente."""
    best: dict[str, tuple[int, object]] = {}
    for it in items:
        parts = it.id.split("_")
        key = "_".join(parts[:3]) if len(parts) >= 4 else it.id
        try:
            ver = int(parts[3]) if len(parts) >= 4 else 0
        except ValueError:
            ver = 0
        if key not in best or ver > best[key][0]:
            best[key] = (ver, it)
    return [v[1] for v in best.values()]


# ─────────────────────────────── CHIRPS ───────────────────────────────


def _chirps_day(url: str, geom: dict) -> float | None:
    """Lluvia (mm) de un día: media del polígono ponderada por la fracción de cada píxel que cubre."""
    import rasterio
    from rasterio.features import rasterize
    from rasterio.warp import transform_geom
    from rasterio.windows import Window
    from affine import Affine

    with rasterio.Env():
        with rasterio.open(url) as src:
            g = transform_geom("EPSG:4326", src.crs, geom)
            xs = [c[0] for c in g["coordinates"][0]]
            ys = [c[1] for c in g["coordinates"][0]]
            r0, c0 = src.index(min(xs), max(ys))
            r1, c1 = src.index(max(xs), min(ys))
            r0, c0 = max(r0, 0), max(c0, 0)
            r1, c1 = min(r1, src.height - 1), min(c1, src.width - 1)
            if r1 < r0 or c1 < c0:
                return None
            win = Window(c0, r0, c1 - c0 + 1, r1 - r0 + 1)
            data = src.read(1, window=win).astype("float64")
            nodata = src.nodata
            fine = src.window_transform(win) * Affine.scale(1 / SUPERSAMPLE, 1 / SUPERSAMPLE)

    h, w = data.shape
    cover = rasterize([(g, 1)], out_shape=(h * SUPERSAMPLE, w * SUPERSAMPLE), transform=fine, fill=0, dtype="uint8")
    weights = cover.reshape(h, SUPERSAMPLE, w, SUPERSAMPLE).mean(axis=(1, 3))
    ok = np.isfinite(data) & (data >= 0)
    if nodata is not None:
        ok &= data != nodata
    if weights.sum() == 0:  # parcela diminuta que no marcó ningún subpíxel: píxel del centroide
        weights = np.zeros_like(data)
        weights[min(h - 1, h // 2), min(w - 1, w // 2)] = 1.0
    weights = weights * ok
    if weights.sum() == 0:
        return None
    return float((data * weights).sum() / weights.sum())


def _precip(geom: dict, year: int, warnings: list[str]) -> float | None:
    start = date(year, 4, 1)
    days = [start + timedelta(d) for d in range((date(year, 6, 1) - start).days)]  # 1 abr – 31 may
    urls = [CHIRPS_URL_TEMPLATE.format(year=d.year, month=d.month, day=d.day) for d in days]

    def one(url):
        try:
            return _retry(_chirps_day, url, geom)
        except Exception:  # noqa: BLE001
            return None

    with ThreadPoolExecutor(WORKERS) as pool:
        values = list(pool.map(one, urls))
    missing = sum(v is None for v in values)
    if missing:
        warnings.append(
            f"CHIRPS: faltaron {missing} de {len(days)} días; no se suma la lluvia incompleta y el modelo usó la mediana de entrenamiento. "
            "Pasa con años recientes (CHIRPS final tarda semanas en publicarse) o si cambió la ruta de descarga."
        )
        return None
    return round(sum(values), 3)


# ─────────────────────────────── Catálogo y orquestación ───────────────────────────────


def _open_client():
    from pystac_client import Client

    return Client.open(STAC_API_URL)


def _search(client, collection: str, geometry: dict, year: int) -> list:
    search = client.search(
        collections=[collection],
        intersects=geometry,
        datetime=f"{year}-04-01T00:00:00Z/{year}-10-31T23:59:59Z",
        query={"eo:cloud_cover": {"lte": CLOUD_MAX}},
        limit=100,
    )
    return list(search.items())


def extract_features_stac(geometry_geojson: dict, year: int = 2025) -> dict:
    """
    Calcula las 10 features del modelo para un polígono, solo con fuentes abiertas.
    Misma forma de salida que gee.extract_features_gee:
        {"features": {...10...}, "advertencias": [...], "area_ha": float}
    """
    geometry, area_ha = validate_geometry(geometry_geojson)
    year = validate_year(year)
    warnings: list[str] = []

    if not _run_lock.acquire(timeout=QUEUE_TIMEOUT_S):
        raise GeeBusy("Hay otro cálculo en curso. Espera unos segundos y reintenta.")
    try:
        _require_libs()
        try:
            client = _open_client()
            s2_items = _retry(_search, client, S2_COLLECTION, geometry, year)
            ls_items = _retry(_search, client, LS_COLLECTION, geometry, year)
        except Exception as e:  # noqa: BLE001
            raise GeeError(f"No se pudo consultar el catálogo de imágenes ({STAC_API_URL}): {_short(e)}") from None

        # ── Conteo de fechas con escena (Sentinel-2 + Landsat 8/9, nubes <= 40 %) ──
        s2_dates = {_utc_day(it.datetime) for it in s2_items if it.datetime}
        ls_dates = {
            _utc_day(it.datetime)
            for it in ls_items
            if it.datetime
            and it.properties.get("platform") in ("landsat-8", "landsat-9")
            and it.properties.get("landsat:collection_category", "T1") == "T1"
        }
        n_obs = len(s2_dates) + len(ls_dates)

        # ── Escenas Sentinel-2 por ventana fenológica ──
        scenes_by_window: dict[str, list] = {w: [] for w in PHENO_WINDOWS}
        for it in _dedupe(s2_items):
            if it.datetime and _utc_day(it.datetime).month in WINDOW_OF_MONTH:
                scenes_by_window[WINDOW_OF_MONTH[_utc_day(it.datetime).month]].append(it)

        def read_scene(item):
            try:
                refs = {k: _asset_ref(item, k) for k in S2_BANDS}
            except KeyError:
                return ("skip", None)
            try:
                return ("ok", _retry(_scene_means, refs, geometry))
            except Exception as e:  # noqa: BLE001
                return ("fail", _short(e))

        medians: dict[str, dict[str, float | None]] = {}
        scene_counts: dict[str, int] = {}
        failed = 0
        total_scenes = 0
        for window, items in scenes_by_window.items():
            with ThreadPoolExecutor(WORKERS) as pool:
                results = list(pool.map(read_scene, items))
            per_band: dict[str, list[float]] = {b: [] for b in ("ndvi", "evi", "lai", "ndwi", "ndti", "sti")}
            used = 0
            last_error = None
            for status_, payload in results:
                total_scenes += 1
                if status_ == "fail":
                    failed += 1
                    last_error = payload
                elif status_ == "ok" and payload is not None:
                    used += 1
                    for b, v in payload.items():
                        if v is not None:
                            per_band[b].append(v)
            scene_counts[window] = used
            medians[window] = {b: (statistics.median(v) if v else None) for b, v in per_band.items()}
            if items and used == 0 and last_error:
                raise GeeError(f"No se pudieron leer las imágenes satelitales de {window}: {last_error}")

        if total_scenes and failed / total_scenes > 0.5:
            raise GeeError("Más de la mitad de las escenas no se pudieron leer; reintenta en unos minutos (la fuente de imágenes no responde).")
        if failed:
            warnings.append(f"{failed} escena(s) no se pudieron leer y no entraron en la mediana.")

        features: dict[str, float | int | None] = {"bas_n_obs_ciclo": n_obs}
        features["precip_acum_emergencia_macollamiento_mm"] = _precip(geometry, year, warnings)
        for key, (window, band) in S2_FEATURES.items():
            features[key] = medians[window][band]
    finally:
        _run_lock.release()

    ordered = {k: features.get(k) for k in FEATURE_KEYS}
    missing = [k for k, v in ordered.items() if v is None]
    if len(missing) > MAX_MISSING:
        raise GeeNoData(
            f"Solo se obtuvieron {len(FEATURE_KEYS) - len(missing)} de {len(FEATURE_KEYS)} variables en {year}. "
            "Suele pasar si las escenas están muy nubladas o el año aún no tiene datos en esa ventana."
        )
    for k in missing:
        warnings.append(f"Sin datos válidos para «{k}»: el modelo usó la mediana de entrenamiento.")
    for window, n in scene_counts.items():
        if n < 3:
            warnings.append(f"Solo {n} escena(s) de Sentinel-2 en la ventana {window}: la mediana es poco representativa.")
    if not (25 <= n_obs <= 90):
        warnings.append(f"El conteo de escenas ({n_obs}) está lejos de las ≈54 del dataset oficial; revisa la ubicación.")

    return {"features": ordered, "advertencias": warnings, "area_ha": round(area_ha, 3)}
