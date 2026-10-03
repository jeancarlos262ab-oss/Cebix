"""
Reto AgroCebada 2026 — Entrenamiento y validación del modelo
================================================================

Qué hace:
  1. Carga features_train.csv (138 parcelas con rendimiento real).
  2. Compara 6 modelos (Ridge, Lasso, ElasticNet, Random Forest, XGBoost, LightGBM)
     con validación espacial LEAVE-REGION-OUT: en cada iteración se deja fuera un
     estado completo (Hidalgo, Puebla o Tlaxcala) y se entrena solo con los otros dos.
     Esto mide qué tan bien generaliza el modelo a una región que nunca vio — más
     exigente y más realista que un k-fold aleatorio, porque parcelas del mismo estado
     comparten suelo/clima/microrregión (si mezclas train/test dentro del mismo estado,
     el modelo se ve mejor de lo que realmente es).
  3. Elige el mejor modelo según RMSE promedio out-of-fold.
  4. Reentrena ese modelo con las 138 parcelas de entrenamiento completas.
  5. Calcula SHAP (importancia global + contribución local por parcela).
  6. Genera intervalos de confianza al 90% por bootstrap de residuales.
  7. Predice el rendimiento de las 59 parcelas de PREDICCION.
  8. Guarda todo lo que el frontend (CEBIX) necesita para dejar de usar datos simulados:
     algorithm_comparison.csv, feature_importance.csv, shap_local.csv, predicciones_finales.csv

Uso:
    python train_model.py --train features_train.csv --predict features_predict.csv --out-dir ./modelo
"""

import argparse
import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, Lasso, ElasticNet, RidgeCV, LassoCV, ElasticNetCV
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.impute import SimpleImputer
import xgboost as xgb
import lightgbm as lgb
import shap

warnings.filterwarnings("ignore")
RANDOM_STATE = 42

NON_FEATURE_COLS = [
    "ID_POLIGONO", "Cultivo", "Municipio", "Estado", "CONJUNTO",
    "area_ha_shp", "area_ha", "rendimiento_t_ha",
]


# ---------------------------------------------------------------------------
# Preparación de datos
# ---------------------------------------------------------------------------

def load_data(train_path, predict_path):
    train = pd.read_csv(train_path)
    predict = pd.read_csv(predict_path)
    feature_cols = [c for c in train.columns if c not in NON_FEATURE_COLS]
    return train, predict, feature_cols


def build_xy(df, feature_cols, imputer=None, scaler=None, fit=False):
    X = df[feature_cols].copy()
    if fit:
        imputer = SimpleImputer(strategy="median")
        X_imp = imputer.fit_transform(X)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_imp)
    else:
        X_imp = imputer.transform(X)
        X_scaled = scaler.transform(X_imp)
    X_scaled = pd.DataFrame(X_scaled, columns=feature_cols, index=df.index)
    return X_scaled, imputer, scaler


# ---------------------------------------------------------------------------
# Modelos a comparar
# ---------------------------------------------------------------------------

def get_models():
    return {
        "Ridge": RidgeCV(alphas=np.logspace(-3, 3, 50)),
        "Lasso": LassoCV(alphas=np.logspace(-3, 1, 50), max_iter=10000, random_state=RANDOM_STATE),
        "ElasticNet": ElasticNetCV(alphas=np.logspace(-3, 1, 30), l1_ratio=[.1, .3, .5, .7, .9], max_iter=10000, random_state=RANDOM_STATE),
        "Random Forest": RandomForestRegressor(n_estimators=300, max_depth=4, min_samples_leaf=4, random_state=RANDOM_STATE),
        "XGBoost": xgb.XGBRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8,
                                     colsample_bytree=0.8, random_state=RANDOM_STATE, verbosity=0),
        "LightGBM": lgb.LGBMRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8,
                                       colsample_bytree=0.8, random_state=RANDOM_STATE, verbosity=-1, min_child_samples=5),
    }


# ---------------------------------------------------------------------------
# Validación espacial leave-region-out
# ---------------------------------------------------------------------------

def leave_region_out_cv(train_df, feature_cols, model_name, model_builder):
    """Devuelve predicciones out-of-fold (una por parcela, generada por un modelo
    que NUNCA vio esa parcela ni su estado durante el entrenamiento)."""
    regions = train_df["Estado"].unique()
    oof_pred = pd.Series(index=train_df.index, dtype=float)

    for region in regions:
        train_idx = train_df["Estado"] != region
        test_idx = train_df["Estado"] == region

        X_train, imputer, scaler = build_xy(train_df.loc[train_idx], feature_cols, fit=True)
        X_test, _, _ = build_xy(train_df.loc[test_idx], feature_cols, imputer=imputer, scaler=scaler, fit=False)
        y_train = train_df.loc[train_idx, "rendimiento_t_ha"]

        model = model_builder()
        model.fit(X_train, y_train)
        oof_pred.loc[test_idx] = model.predict(X_test)

    return oof_pred


def compare_algorithms(train_df, feature_cols):
    results = []
    model_types = {
        "Ridge": "baseline", "Lasso": "baseline", "ElasticNet": "baseline",
        "Random Forest": "ensamble", "XGBoost": "boosting", "LightGBM": "boosting",
    }
    y_true = train_df["rendimiento_t_ha"]

    for name in get_models().keys():
        oof = leave_region_out_cv(train_df, feature_cols, name, lambda n=name: get_models()[n])
        rmse = np.sqrt(mean_squared_error(y_true, oof))
        mae = mean_absolute_error(y_true, oof)
        r2 = r2_score(y_true, oof)
        results.append({"model": name, "rmse": round(rmse, 3), "mae": round(mae, 3),
                         "r2": round(r2, 3), "type": model_types[name]})
        print(f"  {name:15s}  RMSE={rmse:.3f}  MAE={mae:.3f}  R2={r2:.3f}")

    return pd.DataFrame(results).sort_values("rmse")


# ---------------------------------------------------------------------------
# Modelo final + SHAP + intervalos de confianza
# ---------------------------------------------------------------------------

def fit_final_model(train_df, feature_cols, best_model_name):
    X, imputer, scaler = build_xy(train_df, feature_cols, fit=True)
    y = train_df["rendimiento_t_ha"]
    model = get_models()[best_model_name]
    model.fit(X, y)
    return model, imputer, scaler, X, y


def compute_shap(model, model_name, X_train, X_predict):
    linear_models = ("Ridge", "Lasso", "ElasticNet")
    if model_name in linear_models:
        explainer = shap.LinearExplainer(model, X_train)
    else:
        explainer = shap.TreeExplainer(model)

    shap_train = explainer(X_train)
    shap_predict = explainer(X_predict)
    return shap_train, shap_predict


def bootstrap_confidence(train_df, feature_cols, best_model_name, predict_df, n_boot=300, alpha=0.10):
    """Intervalo de confianza (1-alpha) por parcela de predicción, usando bootstrap
    de residuales out-of-fold del modelo ganador (respeta la validación espacial:
    los residuales usados vienen de predicciones donde la parcela estaba fuera del
    entrenamiento)."""
    oof = leave_region_out_cv(train_df, feature_cols, best_model_name, lambda: get_models()[best_model_name])
    residuals = (train_df["rendimiento_t_ha"] - oof).dropna().values

    X_train_full, imputer, scaler, _, _ = fit_final_model(train_df, feature_cols, best_model_name)
    X_pred, _, _ = build_xy(predict_df, feature_cols, imputer=imputer, scaler=scaler, fit=False)

    model = get_models()[best_model_name]
    X_train_scaled, _, _ = build_xy(train_df, feature_cols, imputer=imputer, scaler=scaler, fit=False)
    model.fit(X_train_scaled, train_df["rendimiento_t_ha"])
    point_pred = model.predict(X_pred)

    rng = np.random.default_rng(RANDOM_STATE)
    lo_q, hi_q = alpha / 2, 1 - alpha / 2
    lowers, uppers = [], []
    for p in point_pred:
        boots = p + rng.choice(residuals, size=n_boot, replace=True)
        lowers.append(np.quantile(boots, lo_q))
        uppers.append(np.quantile(boots, hi_q))

    return point_pred, np.array(lowers), np.array(uppers), model, imputer, scaler, X_train_scaled


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main(train_path, predict_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    print("1/6 — Cargando datos...")
    train_df, predict_df, feature_cols = load_data(train_path, predict_path)
    print(f"     {len(train_df)} parcelas de entrenamiento, {len(feature_cols)} features, "
          f"{len(predict_df)} parcelas a predecir.")

    print("\n2/6 — Comparando algoritmos (validación espacial leave-region-out)...")
    comparison = compare_algorithms(train_df, feature_cols)
    comparison.to_csv(os.path.join(out_dir, "algorithm_comparison.csv"), index=False)
    best_model_name = comparison.iloc[0]["model"]
    print(f"\n     Mejor modelo: {best_model_name} (RMSE={comparison.iloc[0]['rmse']})")

    print("\n3/6 — Prediciendo las 59 parcelas de evaluación + intervalos de confianza (90%)...")
    point_pred, lo, hi, final_model, imputer, scaler, X_train_scaled = bootstrap_confidence(
        train_df, feature_cols, best_model_name, predict_df
    )

    print("\n4/6 — Calculando SHAP (importancia global + contribución local)...")
    X_pred_scaled, _, _ = build_xy(predict_df, feature_cols, imputer=imputer, scaler=scaler, fit=False)
    shap_train, shap_pred = compute_shap(final_model, best_model_name, X_train_scaled, X_pred_scaled)

    global_importance = pd.DataFrame({
        "feature": feature_cols,
        "shap_importance_media_abs": np.abs(shap_train.values).mean(axis=0),
    }).sort_values("shap_importance_media_abs", ascending=False)
    global_importance.to_csv(os.path.join(out_dir, "feature_importance.csv"), index=False)

    shap_local = pd.DataFrame(shap_pred.values, columns=feature_cols)
    shap_local.insert(0, "ID_POLIGONO", predict_df["ID_POLIGONO"].values)
    shap_local["base_value"] = shap_pred.base_values if np.ndim(shap_pred.base_values) == 1 else shap_pred.base_values[0]
    shap_local.to_csv(os.path.join(out_dir, "shap_local_prediccion.csv"), index=False)

    print("\n5/6 — Guardando predicciones finales...")
    final = pd.DataFrame({
        "ID_POLIGONO": predict_df["ID_POLIGONO"].values,
        "Estado": predict_df["Estado"].values,
        "Municipio": predict_df["Municipio"].values,
        "rendimiento_t_ha": np.round(point_pred, 2),
        "ic90_inferior": np.round(lo, 2),
        "ic90_superior": np.round(hi, 2),
    })
    final.to_csv(os.path.join(out_dir, "predicciones_finales.csv"), index=False)

    print("\n6/6 — Guardando resumen del modelo (model_summary.json)...")
    summary = {
        "selected_model": best_model_name,
        "cv_strategy": "leave-region-out (Hidalgo / Puebla / Tlaxcala)",
        "cv_metrics": comparison.to_dict(orient="records"),
        "top_10_features": global_importance.head(10).to_dict(orient="records"),
        "n_train": int(len(train_df)),
        "n_predict": int(len(predict_df)),
        "n_features": len(feature_cols),
        "gdd_base_temp_c": 4.0,
        "cloud_threshold_pct": 40,
    }
    with open(os.path.join(out_dir, "model_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\nListo. Todo guardado en {out_dir}/")
    print(f"  - algorithm_comparison.csv   (para ModeloPage / AlgorithmComparisonChart)")
    print(f"  - feature_importance.csv     (para FeatureImportanceChart)")
    print(f"  - shap_local_prediccion.csv  (para ValidacionSHAPPage, por parcela)")
    print(f"  - predicciones_finales.csv   (rendimiento + IC90% de las 59 parcelas)")
    print(f"  - model_summary.json         (resumen para el reporte técnico)")

    print("\nTop 10 variables más importantes (SHAP):")
    print(global_importance.head(10).to_string(index=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--predict", required=True)
    parser.add_argument("--out-dir", default="./modelo")
    args = parser.parse_args()
    main(args.train, args.predict, args.out_dir)
