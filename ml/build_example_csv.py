import argparse
import os

import joblib
import pandas as pd
import shapefile  
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
    p.add_argument("--artifact", default=os.path.join(HERE, "..", "backend", "models", "model_artifact.joblib"))
    p.add_argument("--out", default=os.path.join(HERE, "..", "backend", "data", "ejemplo_features_predict.csv"))
    main(p.parse_args())