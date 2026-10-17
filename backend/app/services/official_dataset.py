"""Features del modelo a partir del CSV Básico OFICIAL del reto (un solo archivo).

La persona sube `Conjunto_datos_BASICO_AgroCebada2026.csv` tal cual lo entrega el reto. De él salen 9 de las
10 features del modelo; la décima (lluvia acumulada abr–may) y los datos de contexto (Estado, Municipio, área,
lat/lng, CONJUNTO) salen de `data/parcelas_oficiales.csv`, una tabla de referencia de las 197 parcelas que se
generó UNA vez con el shapefile y los rasters CHIRPS oficiales (promedio de los píxeles que toca cada parcela,
suma de abril + mayo de 2025). Así no hace falta subir shapefile ni rasters.

Método (reproduce exacto las 59 parcelas de `ejemplo_features_predict.csv`):
  * Ciclo 2025 (abril–octubre). Se descartan observaciones con `porcentaje_nubosidad` > 40 %.
  * Índices: solo Sentinel-2; por ventana fenológica (emergencia-macollamiento abr–may, encañado jun–jul,
    espigado-llenado ago–sep) se toma la MEDIANA de los promedios por fecha (`<índice>_promedio`).
  * bas_n_obs_ciclo: fechas distintas con observación válida (Sentinel-2 + Landsat) entre abril y octubre.
"""

from __future__ import annotations

import pandas as pd

from app.config import PARCELAS_OFICIALES_PATH
from app.services.features.common import CLOUD_MAX, PHENO_WINDOWS, S2_FEATURES

YEAR = 2025
# Columnas mínimas del CSV Básico; con estas el archivo se reconoce como el oficial.
SIGNATURE_COLUMNS = {"ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad"}
_BANDS = sorted({band for _, band in S2_FEATURES.values()})
USECOLS = ["ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad", *[f"{b}_promedio" for b in _BANDS]]

_WINDOW_MONTHS = {
    name: tuple(range(int(a[:2]), int(b[:2]))) for name, (a, b) in PHENO_WINDOWS.items()
}  # fin exclusivo: ("04-01","06-01") -> meses 4 y 5
_ref_cache: pd.DataFrame | None = None


def is_official_basico(columns) -> bool:
    return SIGNATURE_COLUMNS.issubset(set(columns)) and any(c.endswith("_promedio") for c in columns)


# ─────────────────────────────── Planet (CSV PRO, opcional) ───────────────────────────────
# El CSV PRO trae observaciones Planet por parcela y fecha (NDVI, EVI, LAI, MSAVI). Se resumen igual que los índices
# de Sentinel-2: mediana de los promedios por ventana fenológica, con el mismo filtro de nubosidad (<= 40 %).
PLANET_INDICES = ["ndvi", "evi", "lai", "msavi"]
PLANET_SIGNATURE = {"ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad"}
PLANET_USECOLS = ["ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad", *[f"{i}_promedio" for i in PLANET_INDICES]]
PLANET_FEATURES = [f"pro_{i}_{w}" for w in PHENO_WINDOWS for i in PLANET_INDICES]
# El modelo con Planet usa estas 12 + la lluvia abr–may (que sale de la tabla de referencia, no del CSV PRO).


def is_planet_csv(columns) -> bool:
    cols = set(columns)
    return PLANET_SIGNATURE.issubset(cols) and "msavi_promedio" in cols


def planet_features(df: pd.DataFrame) -> pd.DataFrame:
    """Una fila por parcela con las 12 variables Planet (NDVI, EVI, LAI y MSAVI en tres etapas) y el contexto de la parcela."""
    missing = [c for c in PLANET_USECOLS if c not in df.columns]
    if missing:
        raise ValueError("Al archivo de Planet le faltan columnas: " + ", ".join(missing))
    d = df[PLANET_USECOLS].copy()
    d["ID_POLIGONO"] = d["ID_POLIGONO"].astype(str).str.strip()
    d["fecha"] = pd.to_datetime(d["fecha_captura"], format="%d/%m/%Y", errors="coerce")
    d = d[d["fecha"].dt.year == YEAR]
    if d.empty:
        raise ValueError(f"El archivo de Planet no trae observaciones del ciclo {YEAR}.")
    d = d[pd.to_numeric(d["porcentaje_nubosidad"], errors="coerce").fillna(0) <= CLOUD_MAX]
    d["mes"] = d["fecha"].dt.month
    out = pd.DataFrame(index=sorted(d["ID_POLIGONO"].unique()))
    out.index.name = "ID_POLIGONO"
    for w, months in _WINDOW_MONTHS.items():
        sub = d[d["mes"].isin(months)]
        for i in PLANET_INDICES:
            out[f"pro_{i}_{w}"] = sub.groupby("ID_POLIGONO")[f"{i}_promedio"].median().reindex(out.index)
    out = out.join(parcel_reference(), how="left")
    out["Estado"] = out["Estado"].where(out["Estado"].notna(), None)
    return out.reset_index()


def parcel_reference() -> pd.DataFrame:
    global _ref_cache
    if _ref_cache is None:
        _ref_cache = pd.read_csv(PARCELAS_OFICIALES_PATH).set_index("ID_POLIGONO")
    return _ref_cache


def features_from_basico(df: pd.DataFrame) -> pd.DataFrame:
    """DataFrame con una fila por parcela: ID_POLIGONO, contexto y las 10 features del modelo."""
    missing = [c for c in USECOLS if c not in df.columns]
    if missing:
        raise ValueError("Al archivo le faltan columnas: " + ", ".join(missing))

    d = df[USECOLS].copy()
    d["ID_POLIGONO"] = d["ID_POLIGONO"].astype(str).str.strip()
    d["fecha"] = pd.to_datetime(d["fecha_captura"], format="%d/%m/%Y", errors="coerce")
    d = d[d["fecha"].dt.year == YEAR]
    if d.empty:
        raise ValueError(f"El archivo no trae observaciones del ciclo {YEAR}.")

    cloud = pd.to_numeric(d["porcentaje_nubosidad"], errors="coerce")
    d = d[cloud.fillna(0) <= CLOUD_MAX]  # Landsat sin dato de nubes entra (así se calculó el entrenamiento)
    d["mes"] = d["fecha"].dt.month
    s2 = d[d["sensor"] == "Sentinel-2"]

    # Conteo de fechas distintas con observación válida (Sentinel-2 + Landsat), abril–octubre.
    ciclo = d[d["mes"].between(4, 10)]
    n_obs = ciclo.groupby(["ID_POLIGONO", "sensor"])["fecha"].nunique().groupby("ID_POLIGONO").sum()

    out = pd.DataFrame(index=sorted(d["ID_POLIGONO"].unique()))
    out.index.name = "ID_POLIGONO"
    out["bas_n_obs_ciclo"] = n_obs.reindex(out.index).fillna(0)
    for feature, (window, band) in S2_FEATURES.items():
        sub = s2[s2["mes"].isin(_WINDOW_MONTHS[window])]
        out[feature] = sub.groupby("ID_POLIGONO")[f"{band}_promedio"].median().reindex(out.index)

    ref = parcel_reference()
    out = out.join(ref, how="left")
    out["Estado"] = out["Estado"].where(out["Estado"].notna(), None)
    return out.reset_index()
