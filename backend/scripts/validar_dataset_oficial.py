import argparse
import glob
import os
import sys
import warnings

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import PARCELAS_OFICIALES_PATH  

def sample(path, lng, lat):
    with rasterio.open(path) as r:
        x, y = Transformer.from_crs(4326, r.crs, always_xy=True).transform(lng, lat)
        v = np.array([a[0] for a in r.sample(list(zip(x, y)))], float)
        if r.nodata is not None:
            v[v == r.nodata] = np.nan
        v[v < -9000] = np.nan
        return v

def build(ds):
    ref = pd.read_csv(PARCELAS_OFICIALES_PATH)
    y = pd.read_csv(glob.glob(os.path.join(ds, "ID_area_rendimiento*.csv"))[0], encoding="utf-8-sig").iloc[:, :4]
    df = ref.merge(y[["ID_POLIGONO", "RENDIMIENTO_T_HA"]], on="ID_POLIGONO")
    f = lambda pat: glob.glob(os.path.join(ds, "**", pat), recursive=True)[0]  
    for m in range(1, 13):
        df[f"p{m}"] = sample(f(f"PREC_2025_{m:02d}.tif"), df.lng.values, df.lat.values)
        for v in ("Tmin", "Tmax"):
            df[f"{v}{m}"] = sample(f(f"{v}_2025_{m:02d}.tif"), df.lng.values, df.lat.values)
    df["elev"] = sample(f("Elevacion*.tif"), df.lng.values, df.lat.values)
    df["slope"] = sample(f("Pendiente*.tif"), df.lng.values, df.lat.values)
    df["pm"] = df["precip_acum_emergencia_macollamiento_mm"]
    df["pseason"] = df[[f"p{m}" for m in range(4, 11)]].sum(axis=1)
    df["tmean_ciclo"] = df[[f"{v}{m}" for v in ("Tmin", "Tmax") for m in range(4, 11)]].mean(axis=1)
    df["tmin_cold"] = df[[f"Tmin{m}" for m in (4, 5, 6)]].mean(axis=1)
    return df

def oof_blocks(tr, feats, seed, nb=12, n_trees=300):
    X = tr[feats].fillna(tr[feats].median()).values
    y = tr.RENDIMIENTO_T_HA.values
    bl = KMeans(nb, random_state=seed, n_init=5).fit_predict(tr[["lat", "lng"]])
    oof = np.zeros(len(y))
    for b in range(nb):
        te = bl == b
        oof[te] = RandomForestRegressor(n_trees, min_samples_leaf=3, random_state=0, n_jobs=-1).fit(X[~te], y[~te]).predict(X[te])
    return oof, bl

def main(ds):
    df = build(ds)
    tr = df[(df.CONJUNTO == "ENTRENAMIENTO") & df.RENDIMIENTO_T_HA.notna()].reset_index(drop=True)
    y = tr.RENDIMIENTO_T_HA.values
    print(f"{len(tr)} parcelas de entrenamiento; celdas de lluvia distintas: {tr[['lat','lng']].round(1).drop_duplicates().shape[0]}")
    sets = {
        "lluvia abr-may (modelo actual)": ["pm"],
        "+ temperatura": ["pm", "tmean_ciclo", "tmin_cold"],
        "+ elevación y pendiente": ["pm", "elev", "slope"],
        "+ temperatura y terreno": ["pm", "tmean_ciclo", "tmin_cold", "elev", "slope"],
        "+ lluvia de la temporada": ["pm", "pseason"],
        "+ área": ["pm", "area_ha"],
    }
    print("\nRMSE / R² con bloques espaciales (6 repeticiones)")
    for name, feats in sets.items():
        o = [oof_blocks(tr, feats, s)[0] for s in range(6)]
        print(f"  {name:34s} RMSE {np.mean([mean_squared_error(y, a) ** .5 for a in o]):.3f}   R² {np.mean([r2_score(y, a) for a in o]):.3f}")

    print("\nCobertura real del IC 90 % según el factor de ensanchamiento")
    runs = [oof_blocks(tr, ["pm"], s, n_trees=200) for s in range(6)]
    for k in (1.0, 1.15, 1.3):
        cov = []
        for oof, bl in runs:
            res, c = y - oof, 0
            for i in range(len(y)):
                m = (bl != bl[i]) & (tr.Estado.values == tr.Estado[i])
                r = res[m] if m.sum() >= 20 else res[bl != bl[i]]
                lo, hi = np.quantile(r, [.05, .95])
                c += oof[i] + k * lo <= y[i] <= oof[i] + k * hi
            cov.append(c / len(y))
        print(f"  factor {k:.2f}: cobertura {np.mean(cov):.3f}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    main(ap.parse_args().dataset)