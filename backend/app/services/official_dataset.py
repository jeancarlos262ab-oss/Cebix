from __future__ import annotations

import pandas as pd

from app.config import PARCELAS_OFICIALES_PATH
from app.services.features.common import CLOUD_MAX, PHENO_WINDOWS, S2_FEATURES

YEAR = 2025

SIGNATURE_COLUMNS = {"ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad"}
_BANDS = sorted({band for _, band in S2_FEATURES.values()})
USECOLS = ["ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad", *[f"{b}_promedio" for b in _BANDS]]

_WINDOW_MONTHS = {
    name: tuple(range(int(a[:2]), int(b[:2]))) for name, (a, b) in PHENO_WINDOWS.items()
}  
_ref_cache: pd.DataFrame | None = None

def is_official_basico(columns) -> bool:
    return SIGNATURE_COLUMNS.issubset(set(columns)) and any(c.endswith("_promedio") for c in columns)

PLANET_INDICES = ["ndvi", "evi", "lai", "msavi"]
PLANET_SIGNATURE = {"ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad"}
PLANET_USECOLS = ["ID_POLIGONO", "fecha_captura", "sensor", "porcentaje_nubosidad", *[f"{i}_promedio" for i in PLANET_INDICES]]
PLANET_FEATURES = [f"pro_{i}_{w}" for w in PHENO_WINDOWS for i in PLANET_INDICES]

def is_planet_csv(columns) -> bool:
    cols = set(columns)
    return PLANET_SIGNATURE.issubset(cols) and "msavi_promedio" in cols

def planet_features(df: pd.DataFrame) -> pd.DataFrame:
    
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
    d = d[cloud.fillna(0) <= CLOUD_MAX]  
    d["mes"] = d["fecha"].dt.month
    s2 = d[d["sensor"] == "Sentinel-2"]

    
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