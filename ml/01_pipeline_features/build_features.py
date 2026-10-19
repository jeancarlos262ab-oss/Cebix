import argparse
import glob
import os
import re
import warnings

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterstats import zonal_stats

warnings.filterwarnings("ignore")

CYCLE_YEAR = 2025
CLOUD_THRESHOLD = 40.0  
GDD_BASE_TEMP = 4.0  

PHENO_WINDOWS = {
    "emergencia_macollamiento": (4, 5),
    "encanado": (6, 7),
    "espigado_llenado": (8, 9),
}
CYCLE_MONTHS = (4, 10)  

BASICO_INDICES = [
    "ndvi", "evi", "crc", "mcrc", "ndsvi", "srndi", "mra", "lai", "fapar",
    "savi", "vi6t", "ndti", "sti", "ndwi", "endwi", "msi", "emsi",
    "dswi2", "dswi3", "dswi4", "dswi5", "nddi", "enddi",
]

PRO_INDICES = ["ndvi", "evi", "lai", "msavi"]

def load_parcels(shp_path):
    gdf = gpd.read_file(shp_path)
    gdf = gdf.rename(columns={"ID_POLIGON": "ID_POLIGONO", "área_ha": "area_ha_shp"})
    gdf["ID_POLIGONO"] = gdf["ID_POLIGONO"].str.strip()
    
    
    cen = gdf.to_crs(32614).geometry.centroid.to_crs(4326)
    gdf["lat"] = cen.y.round(5)
    gdf["lng"] = cen.x.round(5)
    return gdf[["ID_POLIGONO", "Cultivo", "Municipio", "Estado", "CONJUNTO", "area_ha_shp", "lat", "lng", "geometry"]]

def load_target(csv_path):
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    df["ID_POLIGONO"] = df["ID_POLIGONO"].str.strip()
    df = df.rename(columns={"AREA_HA": "area_ha", "RENDIMIENTO_T_HA": "rendimiento_t_ha"})
    keep = ["ID_POLIGONO", "area_ha", "rendimiento_t_ha", "CONJUNTO"]
    return df[[c for c in keep if c in df.columns]]

def _month_in_window(month, window):
    lo, hi = window
    return lo <= month <= hi

def _load_spectral_csv(csv_path, indices, source_label):
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    df["ID_POLIGONO"] = df["ID_POLIGONO"].str.strip()
    df["fecha_captura"] = pd.to_datetime(df["fecha_captura"], format="%d/%m/%Y", errors="coerce")
    df["anio"] = df["fecha_captura"].dt.year
    df["mes"] = df["fecha_captura"].dt.month
    df["porcentaje_nubosidad"] = pd.to_numeric(df["porcentaje_nubosidad"], errors="coerce")

    
    
    df = df[(df["porcentaje_nubosidad"].isna()) | (df["porcentaje_nubosidad"] <= CLOUD_THRESHOLD)]

    df["fuente"] = source_label
    return df

def aggregate_spectral(df, indices, prefix):
    

    cycle_df = df[(df["anio"] == CYCLE_YEAR) & (df["mes"] >= CYCLE_MONTHS[0]) & (df["mes"] <= CYCLE_MONTHS[1])]

    out = {}
    
    for window_name, window in PHENO_WINDOWS.items():
        sub = cycle_df[cycle_df["mes"].apply(lambda m: _month_in_window(m, window))]
        agg = sub.groupby("ID_POLIGONO")[[f"{i}_promedio" for i in indices if f"{i}_promedio" in sub.columns]].median()
        agg.columns = [f"{prefix}_{c.replace('_promedio', '')}_{window_name}" for c in agg.columns]
        out[window_name] = agg

    
    if f"ndvi_promedio" in cycle_df.columns:
        peak = cycle_df.groupby("ID_POLIGONO")["ndvi_promedio"].max().to_frame(f"{prefix}_ndvi_pico_ciclo")
        out["peak"] = peak

    
    n_obs = cycle_df.groupby("ID_POLIGONO").size().to_frame(f"{prefix}_n_obs_ciclo")
    out["n_obs"] = n_obs

    merged = None
    for piece in out.values():
        merged = piece if merged is None else merged.join(piece, how="outer")
    return merged

def build_spectral_features(data_dir):
    basico_path = os.path.join(data_dir, "Conjunto_datos_BASICO_AgroCebada2026.csv")
    pro_path = os.path.join(data_dir, "Conjunto_datos_PRO_AgroCebada.csv")

    basico = _load_spectral_csv(basico_path, BASICO_INDICES, "basico")
    pro = _load_spectral_csv(pro_path, PRO_INDICES, "pro")

    feats_basico = aggregate_spectral(basico, BASICO_INDICES, prefix="bas")
    feats_pro = aggregate_spectral(pro, PRO_INDICES, prefix="pro")

    return feats_basico.join(feats_pro, how="outer")

def _raster_path_for(base_dir, subfolder, prefix, year, month):
    return os.path.join(base_dir, subfolder, f"{prefix}_{year}_{month:02d}.tif")

def _zonal_mean_sum(gdf, tif_path, stat="mean"):
    
    stats = zonal_stats(gdf.geometry, tif_path, stats=[stat], all_touched=True, nodata=-9999)
    vals = [s[stat] for s in stats]
    return pd.Series(vals, index=gdf["ID_POLIGONO"].values)

def build_climate_features(gdf, chirps_dir, temp_dir):
    months = list(range(CYCLE_MONTHS[0], CYCLE_MONTHS[1] + 1))

    precip_monthly = {}
    tmax_monthly = {}
    tmin_monthly = {}

    for m in months:
        prec_tif = _raster_path_for(chirps_dir, str(CYCLE_YEAR), "PREC", CYCLE_YEAR, m)
        tmax_tif = _raster_path_for(temp_dir, f"Tmax/{CYCLE_YEAR}", "Tmax", CYCLE_YEAR, m)
        tmin_tif = _raster_path_for(temp_dir, f"Tmin/{CYCLE_YEAR}", "Tmin", CYCLE_YEAR, m)

        if os.path.exists(prec_tif):
            precip_monthly[m] = _zonal_mean_sum(gdf, prec_tif, stat="mean")
        if os.path.exists(tmax_tif):
            tmax_monthly[m] = _zonal_mean_sum(gdf, tmax_tif, stat="mean")
        if os.path.exists(tmin_tif):
            tmin_monthly[m] = _zonal_mean_sum(gdf, tmin_tif, stat="mean")

    precip_df = pd.DataFrame(precip_monthly)
    tmax_df = pd.DataFrame(tmax_monthly)
    tmin_df = pd.DataFrame(tmin_monthly)

    feats = pd.DataFrame(index=gdf["ID_POLIGONO"].values)

    
    feats["precip_acum_ciclo_mm"] = precip_df.sum(axis=1)
    for window_name, (lo, hi) in PHENO_WINDOWS.items():
        cols = [m for m in months if lo <= m <= hi]
        feats[f"precip_acum_{window_name}_mm"] = precip_df[[c for c in cols if c in precip_df.columns]].sum(axis=1)

    
    if not tmax_df.empty:
        feats["tmax_media_ciclo"] = tmax_df.mean(axis=1)
    if not tmin_df.empty:
        feats["tmin_media_ciclo"] = tmin_df.mean(axis=1)
    if not tmax_df.empty and not tmin_df.empty:
        tavg_df = (tmax_df + tmin_df) / 2.0
        
        gdd_monthly = (tavg_df - GDD_BASE_TEMP).clip(lower=0) * 30
        feats["gdd_acumulado_ciclo"] = gdd_monthly.sum(axis=1)
        for window_name, (lo, hi) in PHENO_WINDOWS.items():
            cols = [m for m in months if lo <= m <= hi]
            feats[f"gdd_{window_name}"] = gdd_monthly[[c for c in cols if c in gdd_monthly.columns]].sum(axis=1)

    feats.index.name = "ID_POLIGONO"
    return feats

def build_topo_features(gdf, elevacion_tif, pendiente_tif):
    gdf_proj = gdf.to_crs(rasterio.open(elevacion_tif).crs)

    
    
    elev = zonal_stats(gdf_proj.geometry, elevacion_tif, stats=["mean"], nodata=-9999, all_touched=True)
    slope = zonal_stats(gdf_proj.geometry, pendiente_tif, stats=["mean"], nodata=-9999, all_touched=True)

    feats = pd.DataFrame({
        "ID_POLIGONO": gdf["ID_POLIGONO"].values,
        "elevacion_m": [e["mean"] for e in elev],
        "pendiente_grados": [s["mean"] for s in slope],
    }).set_index("ID_POLIGONO")
    return feats

def main(data_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    print("1/5 — Cargando parcelas y rendimiento...")
    shp_glob = glob.glob(os.path.join(data_dir, "**", "Parcelas_Reto_AGC_CONJUNTO.shp"), recursive=True)
    target_glob = glob.glob(os.path.join(data_dir, "ID_area_rendimiento_70_30_Reto_AgroCebada.csv"))
    gdf = load_parcels(shp_glob[0])
    target = load_target(target_glob[0])

    print("2/5 — Procesando índices espectrales (BÁSICO + PRO)...")
    spectral_feats = build_spectral_features(data_dir)

    print("3/5 — Extrayendo clima (CHIRPS + CHIRTS-ERA5)...")
    chirps_dir = glob.glob(os.path.join(data_dir, "**", "Precipitacion_mensual"), recursive=True)[0]
    temp_dir = glob.glob(os.path.join(data_dir, "**", "Reto_AgroCebada_Temperatura_2022_2025"), recursive=True)[0]
    climate_feats = build_climate_features(gdf, chirps_dir, temp_dir)

    print("4/5 — Extrayendo topografía (INEGI CEM 4.0)...")
    elev_tif = glob.glob(os.path.join(data_dir, "**", "Elevacion_INEGI_CEM4_120m.tif"), recursive=True)[0]
    slope_tif = glob.glob(os.path.join(data_dir, "**", "Pendiente_INEGI_CEM4_120m_grados.tif"), recursive=True)[0]
    topo_feats = build_topo_features(gdf, elev_tif, slope_tif)

    print("5/5 — Uniendo todo y guardando...")
    base = gdf.drop(columns="geometry").set_index("ID_POLIGONO")
    final = (
        base
        .join(target.set_index("ID_POLIGONO")[["area_ha", "rendimiento_t_ha"]], how="left")
        .join(spectral_feats, how="left")
        .join(climate_feats, how="left")
        .join(topo_feats, how="left")
    )
    final = final.reset_index()

    train = final[final["CONJUNTO"] == "ENTRENAMIENTO"].copy()
    predict = final[final["CONJUNTO"] == "PREDICCION"].copy()

    final.to_csv(os.path.join(out_dir, "features_completo.csv"), index=False)
    train.to_csv(os.path.join(out_dir, "features_train.csv"), index=False)
    predict.to_csv(os.path.join(out_dir, "features_predict.csv"), index=False)

    print(f"\nListo. {len(final)} parcelas -> {len(train)} train / {len(predict)} predicción.")
    print(f"Columnas de features: {final.shape[1]}")
    print(f"Guardado en: {out_dir}")
    print("\n% de valores faltantes por columna (top 15):")
    print(final.isna().mean().sort_values(ascending=False).head(15))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="Carpeta DATASET_RETO_AGRO_2026 (con subcarpetas ya descomprimidas)")
    parser.add_argument("--out-dir", default="./output")
    args = parser.parse_args()
    main(args.data_dir, args.out_dir)