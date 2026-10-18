"""
Modo "10 variables + ciclo completo": las 4ª combinación de los modos de predicción.

                      | lluvia abr-may (1 etapa) | lluvia de las 3 etapas (ciclo)
  Solo lluvia         | "lluvia"                 | "ciclo"
  10 variables        | "10var"                  | "10var_ciclo"   <-- este script

Usa las mismas 9 variables satelitales del modo "10var" (LAI, NDVI, NDTI, STI, NDWI, EVI y nº de observaciones) y cambia
la lluvia de abril-mayo por la lluvia CHIRPS de las TRES etapas (abr-may, jun-jul, ago-sep): 9 + 3 = 12 columnas.

Se valida igual que los demás modos (bloques espaciales 12x5x6 + estado nuevo) y se exporta
backend/models/model_artifact_10var_ciclo.joblib con el mismo formato. Agrega `modelModes["10var_ciclo"]` a
model_meta.json SIN tocar el resto de los metadatos (no reentrena ni modifica los otros 3 modos).

Nota: las 9 variables satelitales se eligieron con los datos completos (igual que en "10var"), por lo que la cifra de
validación con variables fijas es algo optimista. Se imprime también la de "10var" con variables fijas para compararlas
en igualdad de condiciones.

Uso:  python entrenar_10var_ciclo.py --features ../02_datos_procesados/features_completo.csv --models-dir ../../backend/models
"""
import argparse
import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

import entrenar_y_validar as ev

warnings.filterwarnings("ignore")

RAIN_ETAPAS = ["precip_acum_emergencia_macollamiento_mm", "precip_acum_encanado_mm", "precip_acum_espigado_llenado_mm"]
SAT_FEATURES = [c for c in ev.OPEN_FEATURES if c != ev.PRECIP]
FEATURES = RAIN_ETAPAS + SAT_FEATURES
LABELS = {
    **{k: ev.LABELS[k] for k in SAT_FEATURES},
    "precip_acum_emergencia_macollamiento_mm": "Precipitación en emergencia-macollamiento (abr–may)",
    "precip_acum_encanado_mm": "Precipitación en encañado (jun–jul)",
    "precip_acum_espigado_llenado_mm": "Precipitación en espigado-llenado (ago–sep)",
}
fmt = ev.fmt


def main(args):
    full = pd.read_csv(args.features)
    train = full[full["CONJUNTO"] == "ENTRENAMIENTO"].reset_index(drop=True)
    y = train[ev.TARGET].values
    est = train["Estado"].values
    blocks = [ev.block_splits(train, r) for r in range(ev.N_REPS)]
    states = [ev.state_splits(train)]
    # Validación HONESTA (igual que "10var"): la lluvia de las 3 etapas entra siempre y las otras 9 variables se eligen
    # por importancia usando solo la partición de entrenamiento. Es la cifra que se reporta.
    all_feats = [c for c in full.columns if c not in ev.NON_FEATURE]
    live_feats = [c for c in all_feats if not any(p in c for p in ev.NOT_LIVE)]
    pool = [c for c in live_feats if c not in RAIN_ETAPAS]
    n_sat = len(SAT_FEATURES)

    def infold_fold(tr, te):
        a, _ = ev.prep(tr, te, pool)
        r = ev.RandomForestRegressor(n_estimators=200, max_depth=4, min_samples_leaf=4, random_state=0, n_jobs=-1).fit(a, tr[ev.TARGET].values)
        cols = RAIN_ETAPAS + [pool[i] for i in np.argsort(-r.feature_importances_)[:n_sat]]
        a, b = ev.prep(tr, te, cols)
        return ev.rf().fit(a, tr[ev.TARGET].values).predict(b)

    fixed = ev.fixed_fold(FEATURES, ev.rf)   # mismo RF (prof. 4) que el modo "10var"
    P = ev.oof_predictions(train, blocks, infold_fold)
    m = ev.metrics(y, P)
    m_state = ev.metrics(y, ev.oof_predictions(train, states, infold_fold))
    P_fixed = ev.oof_predictions(train, blocks, fixed)
    m_fixed = ev.metrics(y, P_fixed)
    m_10fixed = ev.metrics(y, ev.oof_predictions(train, blocks, ev.fixed_fold(ev.OPEN_FEATURES, ev.rf)))
    rmse_state = ev.by_state(y, est, P)
    res = (y[None, :] - P).ravel()
    res_state = {st: (y[None, :] - P)[:, est == st].ravel() for st in sorted(set(est))}
    print("10var_ciclo (selección en la partición)", m, "| estado nuevo", m_state, "| por estado", rmse_state)
    print("10var_ciclo (variables fijas, optimista)", m_fixed)
    print("10var (variables fijas, referencia)", m_10fixed)

    imp = SimpleImputer(strategy="median").fit(train[FEATURES])
    sc = StandardScaler().fit(imp.transform(train[FEATURES]))
    X = pd.DataFrame(sc.transform(imp.transform(train[FEATURES])), columns=FEATURES)
    model = ev.rf().fit(X, y)
    joblib.dump({"model": model, "imputer": imp, "scaler": sc, "feature_order": FEATURES, "required_features": RAIN_ETAPAS,
                 "feature_labels": LABELS, "rmse_by_region": rmse_state, "overall_rmse": float(np.sqrt(np.mean(res ** 2))),
                 "residuals_oof": res, "residuals_by_state": res_state, "model_name": "Random Forest"},
                os.path.join(args.models_dir, "model_artifact_10var_ciclo.joblib"))

    Xall = pd.DataFrame(sc.transform(imp.transform(full[FEATURES])), columns=FEATURES)
    sv = shap.TreeExplainer(model)(Xall).values
    importance = sorted(
        ({"key": k, "feature": LABELS[k], "value": fmt(np.abs(sv[:, j]).mean()),
          "direction": "positivo" if sv[:, j].mean() >= 0 else "negativo"} for j, k in enumerate(FEATURES)),
        key=lambda r: -r["value"])
    qs = {st: np.quantile(r, [0.05, 0.95]) for st, r in res_state.items()}
    cov = float(np.mean(np.concatenate([(r >= qs[st][0]) & (r <= qs[st][1]) for st, r in res_state.items()])))

    meta_path = os.path.join(args.models_dir, "model_meta.json")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    meta["modelModes"]["10var_ciclo"] = {
        "label": "10 variables + ciclo completo", "nFeatures": len(FEATURES), "recommended": False,
        "rmse": m["rmse"], "mae": m["mae"], "r2": m["r2"], "newStateRmse": m_state["rmse"], "newStateR2": m_state["r2"],
        "rmseByRegion": rmse_state, "ic90Coverage": fmt(cov, 3),
        "needs": "La lluvia CHIRPS de las tres etapas del ciclo abril–octubre y los índices Sentinel-2/Landsat de la parcela "
                 "(LAI, NDVI, NDTI, STI, NDWI, EVI, nº de observaciones). Si falta algún índice se rellena con la mediana de entrenamiento y se avisa.",
        "importance": importance,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("OK", meta["modelModes"]["10var_ciclo"]["rmse"], importance)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default=os.path.join(here, "..", "02_datos_procesados", "features_completo.csv"))
    ap.add_argument("--models-dir", default=os.path.join(here, "..", "..", "backend", "models"))
    main(ap.parse_args())
