"""Lectura de archivos de parcelas (Shapefile, GeoJSON, KML/KMZ) -> polígonos en lng/lat (EPSG:4326).

La salida es la entrada de `POST /predict-from-geometry`: cada polígono ya viene reproyectado,
sin altitud, de un solo anillo, con área, centroide y el resultado de las MISMAS validaciones que
aplicará el cálculo satelital (`validate_geometry`). Así el frontend sabe de antemano cuáles se
pueden calcular y no gasta 30–90 s en una parcela que va a ser rechazada.

Formatos:
  - Shapefile: `.shp` (+ `.dbf` para atributos, `.prj` para el sistema de coordenadas, `.shx`/`.cpg`
    opcionales), sueltos o dentro de un `.zip`.
  - GeoJSON (`.geojson` / `.json`): Polygon, MultiPolygon, Feature, FeatureCollection, GeometryCollection.
  - KML (`.kml`) y KMZ (`.kmz`).

Los MultiPolygon se separan en un polígono por parte. Los huecos se ignoran (el cálculo satelital
solo usa el contorno exterior). Todo se procesa en memoria: no se escribe nada en disco.
"""

from __future__ import annotations

import io
import json
import math
import re
import codecs
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

from app.services.features.common import MAX_VERTICES, SatelliteError, WARN_AREA_HA, area_warning, validate_geometry

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # lo mismo que anuncia el frontend (máx. 20 MB)
MAX_UNZIPPED_BYTES = 120 * 1024 * 1024  # protección contra zip bombs
MAX_ZIP_ENTRIES = 300
MAX_POLYGONS = 500

_ESTADOS = {"hidalgo": "Hidalgo", "puebla": "Puebla", "tlaxcala": "Tlaxcala"}

# Claves de atributos que se reconocen (se comparan sin mayúsculas, acentos ni símbolos).
_ID_KEYS = ["idpoligono", "idpoligon", "idparcela", "idpol", "id", "folio", "clave", "cve", "parcela", "nombre", "name"]
_NAME_KEYS = ["nombre", "name", "parcela", "descripcion", "description", "idpoligono", "idpoligon", "idparcela", "id"]
_ESTADO_KEYS = ["estado", "noment", "nomestado", "entidad", "state", "region"]
_MUN_KEYS = ["municipio", "nommun", "mun", "municipality", "localidad"]


class GeoParseError(Exception):
    """Error legible para el usuario; `status` es el código HTTP que se devuelve."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ───────────────────────────── utilidades ─────────────────────────────


def _key(text: str) -> str:
    """'ID_POLIGONO' -> 'idpoligono' (sin acentos, mayúsculas ni símbolos)."""
    t = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", t.lower())


def _pick(props: dict, keys: list[str]):
    """Primer valor no vacío cuyo nombre de atributo coincide con alguna de `keys` (en ese orden)."""
    norm = {_key(k): v for k, v in props.items()}
    for k in keys:
        v = norm.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s and s.lower() not in ("none", "null", "nan"):
            return s
    return None


def _canon_estado(value: str | None) -> str | None:
    if not value:
        return None
    k = _key(value)
    for needle, name in _ESTADOS.items():
        if needle in k:
            return name
    return None


def _clean_props(props: dict) -> dict:
    """Atributos simples y acotados (para no devolver miles de columnas ni objetos raros)."""
    out = {}
    for k, v in list(props.items())[:30]:
        if isinstance(v, (int, float, bool)) or v is None:
            out[str(k)[:40]] = v if not (isinstance(v, float) and not math.isfinite(v)) else None
        elif isinstance(v, (str, bytes)):
            out[str(k)[:40]] = (v.decode("utf-8", "replace") if isinstance(v, bytes) else v)[:120]
    return out


def _lonlat_like(ring) -> bool:
    return all(abs(x) <= 180 and abs(y) <= 90 for x, y in ring)


def _ring(coords) -> list[tuple[float, float]]:
    """Convierte una lista de posiciones [x, y, (z)] en [(x, y)], descartando la altitud."""
    out = []
    for pos in coords:
        x, y = float(pos[0]), float(pos[1])
        if not (math.isfinite(x) and math.isfinite(y)):
            raise ValueError("coordenada no finita")
        out.append((x, y))
    return out


# Componentes de un shapefile. Solo `.shp` trae la geometría; el resto la complementa.
SHAPEFILE_EXTS = ("shp", "dbf", "prj", "shx", "cpg")


def _ext(name: str) -> str:
    base = name.rsplit("/", 1)[-1]
    return base.rsplit(".", 1)[-1].lower() if "." in base else ""


def _decode_text(data: bytes) -> str:
    """Texto de un .prj/.cpg: UTF-8 (con o sin BOM) y, si no, Latin-1."""
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", "ignore")


def _encoding_from_cpg(cpg: bytes | None) -> str:
    """Codificación declarada en el .cpg ("UTF-8", "ISO-8859-1", "1252", "ANSI 1252"...).

    Si falta o no se reconoce, UTF-8 (el valor por defecto de QGIS/GDAL moderno); los caracteres que no
    se puedan decodificar se reemplazan en vez de romper la lectura.
    """
    if not cpg:
        return "utf-8"
    raw = _decode_text(cpg).strip().strip("\x00").strip()
    if not raw:
        return "utf-8"
    candidates = [raw, raw.replace(" ", "_")]
    digits = re.search(r"\d{3,5}", raw)
    if digits:  # "1252", "ANSI 1252", "windows-1252" -> cp1252; "65001" -> utf-8
        n = digits.group(0)
        candidates += ["utf-8" if n == "65001" else f"cp{n}"]
    for c in candidates:
        try:
            return codecs.lookup(c).name
        except LookupError:
            continue
    return "utf-8"


# ───────────────────────────── archivos y zips ─────────────────────────────


def _expand(uploads: list[tuple[str, bytes]]) -> dict[str, bytes]:
    """{ruta: bytes} con los zips/kmz ya abiertos (solo en memoria)."""
    files: dict[str, bytes] = {}

    def add(name: str, data: bytes):
        name = name.replace("\\", "/").lstrip("/")
        base = name.rsplit("/", 1)[-1]
        if not base or base.startswith(".") or name.startswith("__MACOSX/"):
            return
        files[name] = data

    for name, data in uploads:
        ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
        if ext in ("zip", "kmz"):
            try:
                zf = zipfile.ZipFile(io.BytesIO(data))
            except zipfile.BadZipFile:
                raise GeoParseError(400, f"«{name}» no es un .zip/.kmz válido.") from None
            infos = [i for i in zf.infolist() if not i.is_dir()]
            if len(infos) > MAX_ZIP_ENTRIES:
                raise GeoParseError(400, f"«{name}» trae demasiados archivos ({len(infos)}).")
            if sum(i.file_size for i in infos) > MAX_UNZIPPED_BYTES:
                raise GeoParseError(413, f"«{name}» descomprimido es demasiado grande.")
            for info in infos:
                try:
                    add(f"{name}/{info.filename}", zf.read(info))
                except (zipfile.BadZipFile, RuntimeError, NotImplementedError):
                    raise GeoParseError(400, f"«{name}»: no se pudo leer «{info.filename}» (¿con contraseña?).") from None
        else:
            add(name, data)
    return files


# ───────────────────────────── lectores ─────────────────────────────
# Cada lector devuelve una lista de polígonos "crudos":
#   {"ring": [(x, y), ...], "holes": bool, "props": dict, "name": str | None, "src": str, "crs": CRS | None}
# `crs` None = lng/lat (WGS84); si hay un CRS, se reproyecta después.


def _polygons_from_geometry(geom, props, src, crs, out: list, skipped: list, depth: int = 0):
    if not isinstance(geom, dict) or depth > 4:
        skipped.append(1)
        return
    t = geom.get("type")
    try:
        if t == "Polygon":
            rings = geom["coordinates"]
            out.append({"ring": _ring(rings[0]), "holes": len(rings) > 1, "props": props, "name": None, "src": src, "crs": crs})
        elif t == "MultiPolygon":
            for rings in geom["coordinates"]:
                out.append({"ring": _ring(rings[0]), "holes": len(rings) > 1, "props": props, "name": None, "src": src, "crs": crs})
        elif t == "GeometryCollection":
            for g in geom.get("geometries", []):
                _polygons_from_geometry(g, props, src, crs, out, skipped, depth + 1)
        else:
            skipped.append(1)  # Point, LineString...
    except (KeyError, IndexError, TypeError, ValueError):
        raise GeoParseError(400, f"{src}: la geometría tiene coordenadas inválidas.") from None


def _geojson_crs(obj: dict, src: str):
    """CRS declarado en el GeoJSON (formato antiguo `crs`); None si es lng/lat."""
    crs = obj.get("crs") if isinstance(obj, dict) else None
    name = ((crs or {}).get("properties") or {}).get("name") if isinstance(crs, dict) else None
    if not name:
        return None
    from pyproj import CRS

    try:
        c = CRS.from_user_input(name)
    except Exception:
        raise GeoParseError(422, f"{src}: no reconozco el sistema de coordenadas «{name}».") from None
    return None if _is_wgs84(c) else c


def _read_geojson(data: bytes, src: str, skipped: list) -> list[dict]:
    try:
        obj = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise GeoParseError(400, f"«{src}» no es un GeoJSON/JSON válido.") from None
    crs = _geojson_crs(obj, src)
    out: list[dict] = []

    def walk(node, depth=0):
        if not isinstance(node, dict) or depth > 4:
            return
        t = node.get("type")
        if t == "FeatureCollection":
            for f in node.get("features") or []:
                walk(f, depth + 1)
        elif t == "Feature":
            props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            if node.get("id") is not None and "id" not in props:
                props = {**props, "id": node["id"]}
            _polygons_from_geometry(node.get("geometry"), props, src, crs, out, skipped)
        else:
            _polygons_from_geometry(node, {}, src, crs, out, skipped)

    walk(obj)
    return out


def _read_kml(data: bytes, src: str, skipped: list) -> list[dict]:
    if re.search(rb"<!\s*(DOCTYPE|ENTITY)", data, re.I):
        raise GeoParseError(400, f"«{src}»: los KML con DTD o entidades no se aceptan.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        raise GeoParseError(400, f"«{src}» no es un KML válido.") from None
    for el in root.iter():  # quita los espacios de nombres: {http://...}Placemark -> Placemark
        if isinstance(el.tag, str):
            el.tag = el.tag.rsplit("}", 1)[-1]

    out: list[dict] = []
    for pm in root.iter("Placemark"):
        props: dict = {}
        for d in pm.iter("Data"):
            v = d.findtext("value")
            if d.get("name") and v is not None:
                props[d.get("name")] = v.strip()
        for d in pm.iter("SimpleData"):
            if d.get("name") and d.text is not None:
                props[d.get("name")] = d.text.strip()
        name = (pm.findtext("name") or "").strip() or None
        found = False
        for poly in pm.iter("Polygon"):
            coords = poly.findtext("outerBoundaryIs/LinearRing/coordinates")
            if not coords:
                continue
            try:
                ring = [(float(p[0]), float(p[1])) for p in (tok.split(",") for tok in coords.split()) if len(p) >= 2]
            except ValueError:
                raise GeoParseError(400, f"«{src}»: coordenadas inválidas en el KML.") from None
            holes = poly.find("innerBoundaryIs") is not None
            out.append({"ring": ring, "holes": holes, "props": props, "name": name, "src": src, "crs": None})
            found = True
        if not found:
            skipped.append(1)
    return out


def _is_wgs84(crs) -> bool:
    try:
        if crs.to_epsg() == 4326:
            return True
    except Exception:
        pass
    name = (crs.name or "").upper()
    return crs.is_geographic and ("WGS 84" in name or "WGS84" in name or "WGS_1984" in name or "CRS84" in name)


def _read_shapefile(files: dict[str, bytes], shp_key: str, skipped: list) -> list[dict]:
    import shapefile  # pyshp

    src = shp_key.rsplit("/", 1)[-1]
    stem = shp_key[:-4]
    lower = {k.lower(): k for k in files}

    folder = stem.rsplit("/", 1)[0] if "/" in stem else ""
    same_folder = [k for k in files if (k.rsplit("/", 1)[0] if "/" in k else "") == folder]
    shp_in_folder = [k for k in same_folder if _ext(k) == "shp"]

    def sibling(ext: str):
        k = lower.get(f"{stem}.{ext}".lower())
        if k:
            return files[k]
        # Si en la carpeta hay un solo .shp y un solo archivo de este tipo con otro nombre
        # (p. ej. "parcelas.shp" + "parcelas_v2.dbf"), se asume que son del mismo shapefile.
        if len(shp_in_folder) == 1:
            others = [k for k in same_folder if _ext(k) == ext]
            if len(others) == 1:
                return files[others[0]]
        return None

    dbf, shx, prj, cpg = sibling("dbf"), sibling("shx"), sibling("prj"), sibling("cpg")

    kwargs = {"shp": io.BytesIO(files[shp_key])}
    if dbf:
        kwargs["dbf"] = io.BytesIO(dbf)
    if shx:
        kwargs["shx"] = io.BytesIO(shx)
    encoding = _encoding_from_cpg(cpg)
    if not cpg and dbf and len(dbf) > 29:
        # Sin .cpg, el byte 29 del .dbf (LDID) indica la página de códigos (Excel/ArcGIS antiguos).
        encoding = {0x01: "cp437", 0x02: "cp850", 0x03: "cp1252", 0x57: "cp1252", 0x65: "cp850"}.get(dbf[29], encoding)
    try:
        reader = shapefile.Reader(encoding=encoding, encodingErrors="replace", **kwargs)
    except Exception as e:
        raise GeoParseError(400, f"«{src}» no se pudo leer como shapefile ({e}).") from None

    polygon_types = {shapefile.POLYGON, shapefile.POLYGONZ, shapefile.POLYGONM}
    if reader.shapeType not in polygon_types:
        raise GeoParseError(422, f"«{src}» no contiene polígonos (tipo de geometría {reader.shapeType}).")

    crs = None
    if prj:
        from pyproj import CRS

        try:
            c = CRS.from_wkt(_decode_text(prj))
            crs = None if _is_wgs84(c) else c
            has_prj = True
        except Exception:
            has_prj = False
    else:
        has_prj = False

    field_names = [f[0] for f in reader.fields[1:]] if dbf else []
    out: list[dict] = []
    try:
        iterator = reader.iterShapeRecords() if dbf else ((s, None) for s in reader.iterShapes())
        for item in iterator:
            shape, record = (item.shape, item.record) if dbf else item
            if shape.shapeType == 0:  # nulo
                skipped.append(1)
                continue
            props = dict(zip(field_names, list(record))) if record is not None else {}
            _polygons_from_geometry(shape.__geo_interface__, props, src, crs, out, skipped)
    except GeoParseError:
        raise
    except Exception as e:
        raise GeoParseError(400, f"«{src}» está dañado o incompleto ({e}).") from None

    if out and not has_prj and not _lonlat_like(out[0]["ring"]):
        raise GeoParseError(
            422,
            f"«{src}» no trae .prj y sus coordenadas no parecen lat/lng. "
            "Incluye el archivo .prj (o sube todo en un .zip) para saber el sistema de coordenadas.",
        )
    return out


# ───────────────────────────── normalización ─────────────────────────────


def _rdp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas-Peucker iterativo sobre una polilínea."""
    n = len(pts)
    if n < 3:
        return pts
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]
        dx, dy = pts[b][0] - ax, pts[b][1] - ay
        length = math.hypot(dx, dy)
        dmax, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = math.hypot(px - ax, py - ay) if length == 0 else abs(dy * (px - ax) - dx * (py - ay)) / length
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def _simplify_ring(pts: list[tuple[float, float]], limit: int) -> list[tuple[float, float]] | None:
    """Reduce un anillo abierto a <= `limit` vértices (tolerancia creciente; máx. ~110 m)."""
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    eps = 1e-6
    while eps <= 1e-3:
        a = _rdp(pts[: far + 1], eps)
        b = _rdp(pts[far:] + [pts[0]], eps)
        res = a[:-1] + b[:-1]
        if len(res) <= limit:
            return res
        eps *= 2
    return None


def _centroid(pts: list[tuple[float, float]]) -> tuple[float, float]:
    x0, y0 = pts[0]
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        x1 -= x0
        y1 -= y0
        x2 -= x0
        y2 -= y0
        cr = x1 * y2 - x2 * y1
        a += cr
        cx += (x1 + x2) * cr
        cy += (y1 + y2) * cr
    if abs(a) < 1e-18:
        return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return x0 + cx / (3 * a), y0 + cy / (3 * a)


def _geodesic_ha(pts: list[tuple[float, float]]) -> float:
    from pyproj import Geod

    area, _ = Geod(ellps="WGS84").polygon_area_perimeter([p[0] for p in pts], [p[1] for p in pts])
    return abs(area) / 10000.0


def _transformer(crs, cache: dict):
    if crs is None:
        return None
    k = crs.to_wkt()
    if k not in cache:
        from pyproj import Transformer

        cache[k] = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    return cache[k]


def _normalize(raw: dict, cache: dict) -> dict:
    """Un polígono crudo -> dict de salida (siempre devuelve algo; si no sirve, trae `error`)."""
    ring = raw["ring"]
    error = None
    pts: list[tuple[float, float]] = []

    try:
        tr = _transformer(raw["crs"], cache)
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        if tr is not None:
            xs, ys = tr.transform(xs, ys)
        for x, y in zip(xs, ys):
            if not (math.isfinite(x) and math.isfinite(y)):
                raise ValueError("coordenadas fuera del dominio de la proyección")
            p = (round(float(x), 7), round(float(y), 7))  # 1e-7° ≈ 1 cm
            if not pts or p != pts[-1]:
                pts.append(p)
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        if not _lonlat_like(pts):
            error = "Las coordenadas no están en lat/lng (EPSG:4326) y el archivo no declara su proyección."
    except Exception as e:
        error = f"No se pudieron reproyectar las coordenadas ({e})."

    if not error and len(pts) < 3:
        error = "El polígono necesita al menos 3 vértices distintos."

    simplified_from = None
    if not error and len(pts) > MAX_VERTICES:
        res = _simplify_ring(pts, MAX_VERTICES - 20)
        if res is None:
            error = f"Tiene demasiados vértices ({len(pts)}) y no se pudo simplificar sin deformarlo."
        else:
            simplified_from, pts = len(pts), res

    geometry = area_ha = lat = lng = None
    if not error:
        closed = [[x, y] for x, y in pts] + [[pts[0][0], pts[0][1]]]
        try:
            geometry, _ = validate_geometry({"type": "Polygon", "coordinates": [closed]})
        except SatelliteError as e:
            error = e.message
            geometry = {"type": "Polygon", "coordinates": [closed]}
        area_ha = round(_geodesic_ha(pts), 4)
        lng, lat = _centroid(pts)
        lng, lat = round(lng, 7), round(lat, 7)

    return {
        "geometry": geometry,
        "area_ha": area_ha,
        "lat": lat,
        "lng": lng,
        "error": error,
        "_simplified_from": simplified_from,
        "_vertices": len(pts),
    }


# ───────────────────────────── punto de entrada ─────────────────────────────


def parse_uploads(uploads: list[tuple[str, bytes]]) -> dict:
    """uploads = [(nombre_de_archivo, bytes)]. Devuelve {n_poligonos, poligonos, advertencias}."""
    if not uploads:
        raise GeoParseError(400, "No se recibió ningún archivo.")
    files = _expand(uploads)
    if not files:
        raise GeoParseError(400, "Los archivos están vacíos.")

    skipped: list[int] = []
    advertencias: list[str] = []
    raw: list[dict] = []
    used: set[str] = set()

    # Shapefiles incompletos: avisa qué falta en lugar de un "formato no compatible" genérico.
    def stem_of(k: str) -> str:
        return k[: k.rfind(".")].lower()

    shp_stems = {stem_of(k) for k in files if _ext(k) == "shp"}
    orphans = sorted({k.rsplit("/", 1)[-1] for k in files if _ext(k) in SHAPEFILE_EXTS and _ext(k) != "shp" and stem_of(k) not in shp_stems})
    if orphans and not shp_stems:
        raise GeoParseError(
            422,
            f"Falta el archivo .shp: es el que contiene la geometría (recibí {', '.join(orphans)}). "
            "Sube el .shp junto con su .dbf y .prj, o todo en un .zip.",
        )
    if len(shp_stems) == 1:
        (only,) = shp_stems
        present = {_ext(k) for k in files if _ext(k) in SHAPEFILE_EXTS}
        notes = []
        if "dbf" not in present:
            notes.append("sin .dbf no hay atributos (nombre, municipio, estado)")
        if "prj" not in present:
            notes.append("sin .prj se asume que las coordenadas ya están en lat/lng")
        if notes:
            advertencias.append(f"«{only.rsplit('/', 1)[-1]}.shp»: " + "; ".join(notes) + ".")

    for key in sorted(files):
        ext = _ext(key)
        base = key.rsplit("/", 1)[-1]
        if ext == "shp":
            raw += _read_shapefile(files, key, skipped)
            used.add(key)
        elif ext in ("geojson", "json"):
            raw += _read_geojson(files[key], base, skipped)
            used.add(key)
        elif ext == "kml":
            raw += _read_kml(files[key], base, skipped)
            used.add(key)

    if not used:
        have = sorted({k.rsplit(".", 1)[-1].lower() for k in files if "." in k})
        raise GeoParseError(
            415,
            "Formato no compatible. Usa un shapefile (.shp con .dbf y .prj, o un .zip), un GeoJSON, un KML o un KMZ"
            + (f" (recibí: {', '.join('.' + e for e in have)})." if have else "."),
        )
    if not raw:
        raise GeoParseError(422, "No encontré ningún polígono en el archivo (solo puntos o líneas).")
    if len(raw) > MAX_POLYGONS:
        raise GeoParseError(422, f"El archivo trae {len(raw)} polígonos; el máximo es {MAX_POLYGONS}.")
    if skipped:
        advertencias.append(f"Se omitieron {len(skipped)} elemento(s) que no son polígonos (puntos, líneas o vacíos).")

    cache: dict = {}
    out: list[dict] = []
    ids_seen: dict[str, int] = {}
    per_source: dict[str, int] = {}
    holes = simplified = 0

    for i, r in enumerate(raw, start=1):
        n = _normalize(r, cache)
        props = r["props"] or {}
        per_source[r["src"]] = per_source.get(r["src"], 0) + 1
        stem = r["src"].rsplit(".", 1)[0]

        ident = _pick(props, _ID_KEYS) or r["name"] or f"{stem}_{per_source[r['src']]}"
        ident = ident[:70]
        ids_seen[ident] = ids_seen.get(ident, 0) + 1
        if ids_seen[ident] > 1:
            ident = f"{ident}_{ids_seen[ident]}"
        nombre = _pick(props, _NAME_KEYS) or r["name"] or ident

        if r["holes"]:
            holes += 1
        if n["_simplified_from"]:
            simplified += 1

        out.append(
            {
                "ID_POLIGONO": ident,
                "nombre": nombre[:80],
                "Estado": _canon_estado(_pick(props, _ESTADO_KEYS)),
                "Municipio": (_pick(props, _MUN_KEYS) or "")[:80] or None,
                "geometry": n["geometry"],
                "area_ha": n["area_ha"],
                "lat": n["lat"],
                "lng": n["lng"],
                "vertices": n["_vertices"],
                "error": n["error"],
                "origen": r["src"],
                "propiedades": _clean_props(props),
            }
        )

    big = [o for o in out if o["area_ha"] is not None and area_warning(o["area_ha"])]
    if big:
        advertencias.append(
            f"{len(big)} polígono(s) miden más de {int(WARN_AREA_HA):,} ha (el mayor: {max(o['area_ha'] for o in big):,.0f} ha). "
            "No es recomendable: una zona tan grande mezcla cultivos y coberturas distintas. Se calculan igual."
        )
    if holes:
        advertencias.append(f"{holes} polígono(s) tienen huecos: el cálculo usa solo el contorno exterior.")
    if simplified:
        advertencias.append(f"{simplified} polígono(s) se simplificaron a menos de {MAX_VERTICES} vértices (límite del cálculo).")

    return {"n_poligonos": len(out), "n_validos": sum(1 for p in out if not p["error"]), "poligonos": out, "advertencias": advertencias}
