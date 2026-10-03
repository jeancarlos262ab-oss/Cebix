"""
Genera `backend/data/ejemplo_features_predict.csv`: el archivo de ejemplo que la API sirve en
GET /example-csv y que el dashboard usa en el botón "Ejecutar con archivo de ejemplo".

Toma las parcelas de evaluación (features_predict.csv) con las 10 columnas que usa el modelo
y les agrega `lat` / `lng` (centroide de cada polígono en el shapefile oficial del reto), porque
el mapa del dashboard necesita coordenadas y las features no las traen.

No contiene rendimiento: el modelo lo calcula en vivo al ejecutarse.

Uso (desde ml/):
    python build_example_csv.py --shapefile /ruta/a/Parcelas_Reto_AGC_CONJUNTO.shp
    # el .shp viene dentro de DATASET_RETO_AGRO_2026/Parcelas_Reto_AGC_CONJUNTO_70_30.zip

Requiere: pip install pyshp shapely pandas joblib
"""

import argparse
import os

import joblib
import pandas as pd
import shapefile  # pyshp
from shapely.geometry import shape

HERE = os.path.dirname(os.path.abspath(__file__))
META_COLS = ["ID_POLIGONO", "Estado", "Municipio", "area_ha", "lat", "lng"]


def centroids(shp_path):
    reader = shapefile.Reader(shp_path)
    names = [f[0] for f in reader.fields][1:]
    id_field = next(n for n in names if n.upper().startswith("ID_POLIG"))
    out = {}
    for sr in reader.shapeRecords():
        pid = sr.record.as_dict()[id_field]
        c = shape(sr.shape.__geo_interface__).centroid
        out[pid] = (round(c.y, 5), round(c.x, 5))
    return out


def main(args):
    artifact = joblib.load(args.artifact)
    features = artifact["feature_order"]
    df = pd.read_csv(args.features_predict)
    cents = centroids(args.shapefile)

    df["lat"] = df["ID_POLIGONO"].map(lambda i: cents.get(i, (None, None))[0])
    df["lng"] = df["ID_POLIGONO"].map(lambda i: cents.get(i, (None, None))[1])
    missing = int(df["lat"].isna().sum())
    if missing:
        raise SystemExit(f"{missing} parcelas sin centroide en el shapefile; revisa los ID_POLIGONO.")

    out = df[META_COLS + features]
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    out.to_csv(args.out, index=False)
    print(f"{len(out)} parcelas -> {args.out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--shapefile", required=True)
    p.add_argument("--features-predict", default=os.path.join(HERE, "02_datos_procesados", "features_predict.csv"))
    p.add_argument("--artifact", default=os.path.join(HERE, "..", "backend", "model_artifact.joblib"))
    p.add_argument("--out", default=os.path.join(HERE, "..", "backend", "data", "ejemplo_features_predict.csv"))
    main(p.parse_args())
