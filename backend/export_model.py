"""
Serializa el modelo final (Random Forest, top-10 features) + imputer + scaler +
metadata (RMSE por región, features, labels) en un solo archivo .joblib que el
backend de inferencia (api/main.py) carga al arrancar.

Uso:
    python export_model.py --train ../02_datos_procesados/features_train.csv --out ./model_artifact.joblib
"""
import argparse
import os
import sys

import joblib
import numpy as np
from sklearn.metrics import mean_squared_error

# train_model.py puede estar junto a este archivo, en ../03_modelo (paquete original) o en la raíz del repo.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _p in (_HERE, os.path.join(_HERE, "03_modelo"), os.path.join(_HERE, "..", "03_modelo"), os.path.join(_HERE, "..")):
    if os.path.exists(os.path.join(_p, "train_model.py")):
        sys.path.insert(0, _p)
        break
from train_model import load_data, build_xy, get_models, leave_region_out_cv  # noqa: E402

BEST_MODEL_NAME = "Random Forest"
SELECTED_FEATURES = [
    "precip_acum_emergencia_macollamiento_mm",
    "bas_n_obs_ciclo",
    "bas_lai_espigado_llenado",
    "bas_ndti_emergencia_macollamiento",
    "bas_sti_encanado",
    "bas_ndvi_emergencia_macollamiento",
    "bas_ndwi_espigado_llenado",
    "bas_ndti_encanado",
    "bas_evi_emergencia_macollamiento",
    "bas_evi_encanado",
]
FEATURE_LABELS = {
    "precip_acum_emergencia_macollamiento_mm": "Precipitación en emergencia-macollamiento",
    "bas_n_obs_ciclo": "Densidad de observaciones válidas (Sentinel-2/Landsat)",
    "bas_lai_espigado_llenado": "LAI en espigado-llenado",
    "bas_ndti_emergencia_macollamiento": "NDTI en emergencia-macollamiento",
    "bas_sti_encanado": "STI en encañado",
    "bas_ndvi_emergencia_macollamiento": "NDVI en emergencia-macollamiento",
    "bas_ndwi_espigado_llenado": "NDWI en espigado-llenado",
    "bas_ndti_encanado": "NDTI en encañado",
    "bas_evi_emergencia_macollamiento": "EVI en emergencia-macollamiento",
    "bas_evi_encanado": "EVI en encañado",
}


def main(train_path, out_path):
    train_df, _predict_df_unused, _all_cols = load_data(train_path, train_path)

    X, imputer, scaler = build_xy(train_df, SELECTED_FEATURES, fit=True)
    y = train_df["rendimiento_t_ha"]
    model = get_models()[BEST_MODEL_NAME]
    model.fit(X, y)

    oof = leave_region_out_cv(train_df, SELECTED_FEATURES, BEST_MODEL_NAME, lambda: get_models()[BEST_MODEL_NAME])
    rmse_by_region = {
        region: float(np.sqrt(mean_squared_error(y[train_df["Estado"] == region], oof[train_df["Estado"] == region])))
        for region in train_df["Estado"].unique()
    }
    overall_rmse = float(np.sqrt(mean_squared_error(y, oof)))
    residuals = (y - oof).dropna().values

    artifact = {
        "model": model,
        "imputer": imputer,
        "scaler": scaler,
        "feature_order": SELECTED_FEATURES,
        "feature_labels": FEATURE_LABELS,
        "rmse_by_region": rmse_by_region,
        "overall_rmse": overall_rmse,
        "residuals_oof": residuals,  # para bootstrap de intervalos de confianza
        "model_name": BEST_MODEL_NAME,
    }
    joblib.dump(artifact, out_path)
    print(f"Modelo exportado a {out_path}")
    print(f"RMSE global: {overall_rmse:.3f} | RMSE por región: {rmse_by_region}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--out", default="./model_artifact.joblib")
    args = parser.parse_args()
    main(args.train, args.out)
