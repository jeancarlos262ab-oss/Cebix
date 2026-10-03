"""
Igual que select_features.py, pero excluye TODAS las columnas de Planet (prefijo pro_)
desde el ranking -- no solo las que hayan quedado en el top-15. Esto deja un modelo que
se puede recalcular 100% con fuentes gratuitas (Sentinel-2/Landsat vía Google Earth
Engine + CHIRPS + SRTM/INEGI), sin depender de la API de pago de Planet.

Uso:
    python select_features_sin_planet.py --train ../02_datos_procesados/features_train.csv \
        --predict ../02_datos_procesados/features_predict.csv --out-dir ./modelo_sin_planet
"""
import argparse
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from train_model import (  # noqa: E402
    load_data, build_xy, get_models, leave_region_out_cv, compute_shap,
    bootstrap_confidence,
)
from select_features import rank_features_by_shap, evaluate_feature_subset, CANDIDATE_SIZES  # noqa: E402
import shap  # noqa: E402

warnings.filterwarnings("ignore")

# Índices que NO se pueden reproducir en Google Earth Engine con fuentes gratuitas y
# aritmética simple de bandas (fórmulas del PDF oficial de FIRA):
#   pro_*        -> Planet (API de pago)
#   fapar        -> requiere portar un script de red neuronal de Sentinel Hub
#   vi6t         -> Landsat con banda térmica (ST_B10), distinta cadena de procesamiento
#   mra          -> depende de NDVImax/hv/albedo (parámetros adicionales)
#   nddi/enddi   -> usan NDVI/NDWI remuestreados a enteros de 8 bits (no reproducible exacto)
EXCLUDED_PATTERNS = ("pro_", "fapar", "vi6t", "mra", "nddi", "enddi")


def is_excluded(col):
    return any(pat in col for pat in EXCLUDED_PATTERNS)


def main(train_path, predict_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    print("1/5 — Cargando datos y excluyendo columnas Planet (pro_*)...")
    train_df, predict_df, all_feature_cols = load_data(train_path, predict_path)
    feature_cols = [c for c in all_feature_cols if not is_excluded(c)]
    print(f"     {len(all_feature_cols)} features originales -> {len(feature_cols)} reproducibles en vivo "
          f"({len(all_feature_cols) - len(feature_cols)} excluidas: Planet, FAPAR, VI6T, MRA, NDDI/ENDDI)")

    print("\n2/5 — Rankeando por SHAP (Random Forest, todas las parcelas, sin Planet)...")
    ranking = rank_features_by_shap(train_df, feature_cols)
    ranking.to_csv(os.path.join(out_dir, "ranking_features_shap_sin_planet.csv"), header=["shap_importance"])

    print("\n3/5 — Probando tamaños de subconjunto (leave-region-out CV)...")
    search_results = []
    best_overall = {"rmse": np.inf}
    for n in CANDIDATE_SIZES:
        if n > len(feature_cols):
            continue
        subset = ranking.head(n).index.tolist()
        res = evaluate_feature_subset(train_df, subset)
        res["n_features"] = n
        search_results.append(res)
        best_row = res.sort_values("rmse").iloc[0]
        print(f"  top-{n:2d}  ->  {best_row['model']:15s} RMSE={best_row['rmse']:.3f} R2={best_row['r2']:.3f}")
        if best_row["rmse"] < best_overall["rmse"]:
            best_overall = {"rmse": best_row["rmse"], "mae": best_row["mae"], "r2": best_row["r2"],
                             "model": best_row["model"], "n_features": n}

    search_df = pd.concat(search_results, ignore_index=True)
    search_df.to_csv(os.path.join(out_dir, "busqueda_n_features_sin_planet.csv"), index=False)
    print(f"\n   Mejor: {best_overall['model']} con top-{best_overall['n_features']} "
          f"(RMSE={best_overall['rmse']:.3f}, R2={best_overall['r2']:.3f})")

    final_features = ranking.head(best_overall["n_features"]).index.tolist()
    best_model_name = best_overall["model"]

    print("\n4/5 — Reentrenando modelo final y calculando SHAP...")
    point_pred, lo, hi, final_model, imputer, scaler, X_train_scaled = bootstrap_confidence(
        train_df, final_features, best_model_name, predict_df
    )
    X_pred_scaled, _, _ = build_xy(predict_df, final_features, imputer=imputer, scaler=scaler, fit=False)
    shap_train, shap_pred = compute_shap(final_model, best_model_name, X_train_scaled, X_pred_scaled)

    global_importance = pd.DataFrame({
        "feature": final_features,
        "shap_importance_media_abs": np.abs(shap_train.values).mean(axis=0),
    }).sort_values("shap_importance_media_abs", ascending=False)
    global_importance.to_csv(os.path.join(out_dir, "feature_importance.csv"), index=False)

    print("\n5/5 — Guardando predicciones y resumen...")
    final = pd.DataFrame({
        "ID_POLIGONO": predict_df["ID_POLIGONO"].values,
        "Estado": predict_df["Estado"].values,
        "rendimiento_t_ha": np.round(point_pred, 2),
        "ic90_inferior": np.round(lo, 2),
        "ic90_superior": np.round(hi, 2),
    })
    final.to_csv(os.path.join(out_dir, "predicciones_finales.csv"), index=False)

    summary = {
        "selected_model": best_model_name,
        "n_features_selected": best_overall["n_features"],
        "features_seleccionadas": final_features,
        "excluye_planet": True,
        "cv_metrics_por_n": search_df.round(3).to_dict(orient="records"),
        "mejor_resultado": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in best_overall.items()},
    }
    with open(os.path.join(out_dir, "model_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\nListo. Guardado en {out_dir}/")
    print("\nFeatures finales (sin Planet):")
    for f in final_features:
        print(f"  - {f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--predict", required=True)
    parser.add_argument("--out-dir", default="./modelo_sin_planet")
    args = parser.parse_args()
    main(args.train, args.predict, args.out_dir)
