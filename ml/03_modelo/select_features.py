"""
Reto AgroCebada 2026 — Selección de features + reentrenamiento
==================================================================

Con 138 parcelas de entrenamiento y 97 features, hay riesgo de sobreajuste incluso con
modelos regularizados. Este script prueba distintos tamaños de subconjunto de features
(top-10, 15, 20, 25, 30, 40, 50, y las 97 completas), rankeadas por importancia SHAP,
y para cada tamaño corre la misma validación espacial leave-region-out que train_model.py
para los 6 modelos. Se queda con la combinación (N features, modelo) que dé el menor RMSE
out-of-fold, y con eso reentrena el modelo final.

Uso:
    python select_features.py --train ../02_datos_procesados/features_train.csv \
        --predict ../02_datos_procesados/features_predict.csv --out-dir ./modelo_v2
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
    bootstrap_confidence, NON_FEATURE_COLS, RANDOM_STATE,
)
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score  # noqa: E402
import shap  # noqa: E402

warnings.filterwarnings("ignore")

CANDIDATE_SIZES = [10, 15, 20, 25, 30, 40, 50, 97]


def rank_features_by_shap(train_df, feature_cols):
    """Rankea todas las features usando SHAP de un Random Forest entrenado con TODAS
    las parcelas de entrenamiento (solo para rankear, no para medir desempeño — el
    desempeño se mide después, por separado, con leave-region-out)."""
    X, imputer, scaler = build_xy(train_df, feature_cols, fit=True)
    y = train_df["rendimiento_t_ha"]
    model = get_models()["Random Forest"]
    model.fit(X, y)
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer(X)
    importance = pd.Series(np.abs(shap_vals.values).mean(axis=0), index=feature_cols)
    return importance.sort_values(ascending=False)


def evaluate_feature_subset(train_df, feature_subset):
    y_true = train_df["rendimiento_t_ha"]
    rows = []
    for name in get_models().keys():
        oof = leave_region_out_cv(train_df, feature_subset, name, lambda n=name: get_models()[n])
        rmse = np.sqrt(mean_squared_error(y_true, oof))
        mae = mean_absolute_error(y_true, oof)
        r2 = r2_score(y_true, oof)
        rows.append({"model": name, "rmse": rmse, "mae": mae, "r2": r2})
    return pd.DataFrame(rows)


def main(train_path, predict_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    print("1/5 — Cargando datos y rankeando features por SHAP (Random Forest, todas las 138 parcelas)...")
    train_df, predict_df, feature_cols = load_data(train_path, predict_path)
    ranking = rank_features_by_shap(train_df, feature_cols)
    ranking.to_csv(os.path.join(out_dir, "ranking_features_shap.csv"), header=["shap_importance"])

    print("\n2/5 — Probando distintos tamaños de subconjunto (leave-region-out CV)...")
    search_results = []
    best_overall = {"rmse": np.inf}

    for n in CANDIDATE_SIZES:
        subset = ranking.head(n).index.tolist()
        res = evaluate_feature_subset(train_df, subset)
        res["n_features"] = n
        search_results.append(res)
        best_row = res.sort_values("rmse").iloc[0]
        print(f"  top-{n:2d} features  ->  mejor: {best_row['model']:15s} RMSE={best_row['rmse']:.3f} R2={best_row['r2']:.3f}")
        if best_row["rmse"] < best_overall["rmse"]:
            best_overall = {"rmse": best_row["rmse"], "mae": best_row["mae"], "r2": best_row["r2"],
                             "model": best_row["model"], "n_features": n}

    search_df = pd.concat(search_results, ignore_index=True)
    search_df.to_csv(os.path.join(out_dir, "busqueda_n_features.csv"), index=False)

    print(f"\n   Mejor combinación: {best_overall['model']} con top-{best_overall['n_features']} features "
          f"(RMSE={best_overall['rmse']:.3f}, R2={best_overall['r2']:.3f})")

    final_features = ranking.head(best_overall["n_features"]).index.tolist()
    best_model_name = best_overall["model"]

    print("\n3/5 — Reentrenando el modelo final con las features seleccionadas...")
    point_pred, lo, hi, final_model, imputer, scaler, X_train_scaled = bootstrap_confidence(
        train_df, final_features, best_model_name, predict_df
    )

    print("\n4/5 — Recalculando SHAP con el modelo final...")
    X_pred_scaled, _, _ = build_xy(predict_df, final_features, imputer=imputer, scaler=scaler, fit=False)
    shap_train, shap_pred = compute_shap(final_model, best_model_name, X_train_scaled, X_pred_scaled)

    global_importance = pd.DataFrame({
        "feature": final_features,
        "shap_importance_media_abs": np.abs(shap_train.values).mean(axis=0),
    }).sort_values("shap_importance_media_abs", ascending=False)
    global_importance.to_csv(os.path.join(out_dir, "feature_importance.csv"), index=False)

    shap_local = pd.DataFrame(shap_pred.values, columns=final_features)
    shap_local.insert(0, "ID_POLIGONO", predict_df["ID_POLIGONO"].values)
    shap_local["base_value"] = shap_pred.base_values if np.ndim(shap_pred.base_values) == 1 else shap_pred.base_values[0]
    shap_local.to_csv(os.path.join(out_dir, "shap_local_prediccion.csv"), index=False)

    print("\n5/5 — Guardando predicciones finales y resumen...")
    final = pd.DataFrame({
        "ID_POLIGONO": predict_df["ID_POLIGONO"].values,
        "Estado": predict_df["Estado"].values,
        "Municipio": predict_df["Municipio"].values,
        "rendimiento_t_ha": np.round(point_pred, 2),
        "ic90_inferior": np.round(lo, 2),
        "ic90_superior": np.round(hi, 2),
    })
    final.to_csv(os.path.join(out_dir, "predicciones_finales.csv"), index=False)

    summary = {
        "selected_model": best_model_name,
        "n_features_selected": best_overall["n_features"],
        "n_features_originales": len(feature_cols),
        "features_seleccionadas": final_features,
        "cv_strategy": "leave-region-out (Hidalgo / Puebla / Tlaxcala)",
        "cv_metrics_por_n": search_df.round(3).to_dict(orient="records"),
        "mejor_resultado": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in best_overall.items()},
        "n_train": int(len(train_df)),
        "n_predict": int(len(predict_df)),
    }
    with open(os.path.join(out_dir, "model_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\nListo. Guardado en {out_dir}/")
    print("\nFeatures seleccionadas (ordenadas por importancia SHAP):")
    for f in final_features:
        print(f"  - {f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--predict", required=True)
    parser.add_argument("--out-dir", default="./modelo_v2")
    args = parser.parse_args()
    main(args.train, args.predict, args.out_dir)
