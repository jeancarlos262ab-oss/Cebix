"""
Validar el cálculo satelital en vivo contra el dataset oficial
==============================================================

Corre la extracción de features (por defecto con fuentes abiertas, sin cuenta) sobre N parcelas de ENTRENAMIENTO (cuyos valores oficiales ya están en
features_completo.csv), compara las 10 columnas y deja:
  * una tabla de diferencia porcentual en consola, y
  * un JSON [{id, official, live}] que la pantalla «Validación del cálculo» del frontend puede usar
    (guárdalo como cebix/src/data/sateliteValidation.json).

Uso (desde backend/):
    pip install -r requirements.txt geopandas
    python scripts/validate_satelite.py \\
        --csv ../ml/02_datos_procesados/features_completo.csv \\
        --shp ruta/a/Parcelas_Reto_AGC_CONJUNTO.shp \\
        --n 5 --out validacion_satelite.json

Cada parcela tarda ~30–90 s (se procesan de una en una).
Criterio: índices y lluvia dentro de ±15 %; bas_n_obs_ciclo puede diferir más (±30 %).
"""

import argparse
import json
import os
import sys

import pandas as pd

# Permite `python scripts/validate_satelite.py` desde backend/ (agrega backend/ al path para importar `app`).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.features import common as g  # noqa: E402
from app.services.features import stac as st  # noqa: E402

TOL_DEFAULT, TOL_NOBS = 15.0, 30.0


def diff_pct(official, live):
    if official in (None, 0) or live is None or pd.isna(official) or pd.isna(live):
        return None
    return (live - official) / abs(official) * 100


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", required=True, help="features_completo.csv")
    ap.add_argument("--shp", required=True, help="Parcelas_Reto_AGC_CONJUNTO.shp")
    ap.add_argument("--id-col", default="ID_POLIGONO", help="columna de ID en el shapefile")
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--year", type=int, default=2025)
    ap.add_argument("--out", default="validacion_satelite.json")
    args = ap.parse_args()

    try:
        import geopandas as gpd
    except ImportError:
        sys.exit("Falta geopandas: pip install geopandas")

    df = pd.read_csv(args.csv)
    train = df[df["CONJUNTO"] == "ENTRENAMIENTO"].sort_values("ID_POLIGONO")
    # Reparte la muestra entre estados para que no salgan las 5 de Hidalgo.
    sample = train.groupby("Estado", group_keys=False).apply(lambda x: x.head(max(1, args.n // 3 + 1))).head(args.n)

    gdf = gpd.read_file(args.shp).to_crs(4326).set_index(args.id_col)

    rows = []
    for pid in sample["ID_POLIGONO"]:
        if pid not in gdf.index:
            print(f"· {pid}: no está en el shapefile, se omite")
            continue
        geom = json.loads(gpd.GeoSeries([gdf.loc[pid].geometry]).to_json())["features"][0]["geometry"]
        if geom["type"] == "MultiPolygon":  # se usa el polígono más grande
            geom = {"type": "Polygon", "coordinates": max(geom["coordinates"], key=lambda p: g._ring_area_ha(p[0]))}
        print(f"· {pid}: calculando desde satélite…", flush=True)
        live = st.extract_features_stac(geom, args.year)["features"]
        official = {k: float(sample.loc[sample["ID_POLIGONO"] == pid, k].iloc[0]) for k in g.FEATURE_KEYS}
        rows.append({"id": pid, "official": official, "live": live})

    if not rows:
        sys.exit("No se pudo validar ninguna parcela (revisa --id-col y el shapefile).")

    ok = total = 0
    print(f"\n{'variable':45s}" + "".join(f"{r['id']:>11s}" for r in rows))
    for k in g.FEATURE_KEYS:
        tol = TOL_NOBS if k == "bas_n_obs_ciclo" else TOL_DEFAULT
        cells = []
        for r in rows:
            d = diff_pct(r["official"][k], r["live"][k])
            total += 1
            if d is not None and abs(d) <= tol:
                ok += 1
            cells.append("      —" if d is None else f"{d:+9.1f}%")
        print(f"{k:45s}" + "".join(f"{c:>11s}" for c in cells) + f"   (tol ±{tol:.0f}%)")
    print(f"\nDentro de tolerancia: {ok}/{total} ({ok / total:.0%})")

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"Guardado en {args.out}")


if __name__ == "__main__":
    main()
