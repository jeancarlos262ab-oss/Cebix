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

CICLO_FEATURES = [
    "precip_acum_emergencia_macollamiento_mm",
    "precip_acum_encanado_mm",
    "precip_acum_espigado_llenado_mm",
]
CICLO_LABELS = {
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
    fold = ev.fixed_fold(CICLO_FEATURES, ev.prod_rf)

    P = ev.oof_predictions(train, blocks, fold)
    m = ev.metrics(y, P)
    m_state = ev.metrics(y, ev.oof_predictions(train, states, fold))
    rmse_state = ev.by_state(y, est, P)
    res = (y[None, :] - P).ravel()
    res_state = {st: (y[None, :] - P)[:, est == st].ravel() for st in sorted(set(est))}
    print("bloques", m, "| estado nuevo", m_state, "| por estado", rmse_state)

    imp = SimpleImputer(strategy="median").fit(train[CICLO_FEATURES])
    sc = StandardScaler().fit(imp.transform(train[CICLO_FEATURES]))
    X = pd.DataFrame(sc.transform(imp.transform(train[CICLO_FEATURES])), columns=CICLO_FEATURES)
    model = ev.prod_rf().fit(X, y)
    joblib.dump({"model": model, "imputer": imp, "scaler": sc, "feature_order": CICLO_FEATURES, "required_features": CICLO_FEATURES,
                 "feature_labels": CICLO_LABELS, "rmse_by_region": rmse_state, "overall_rmse": float(np.sqrt(np.mean(res ** 2))),
                 "residuals_oof": res, "residuals_by_state": res_state, "model_name": "Random Forest"},
                os.path.join(args.models_dir, "model_artifact_ciclo.joblib"))

    Xall = pd.DataFrame(sc.transform(imp.transform(full[CICLO_FEATURES])), columns=CICLO_FEATURES)
    sv = shap.TreeExplainer(model)(Xall).values
    importance = sorted(
        ({"key": k, "feature": CICLO_LABELS[k], "value": fmt(np.abs(sv[:, j]).mean()),
          "direction": "positivo" if sv[:, j].mean() >= 0 else "negativo"} for j, k in enumerate(CICLO_FEATURES)),
        key=lambda r: -r["value"])
    qs = {st: np.quantile(r, [0.05, 0.95]) for st, r in res_state.items()}
    cov = float(np.mean(np.concatenate([(r >= qs[st][0]) & (r <= qs[st][1]) for st, r in res_state.items()])))

    meta_path = os.path.join(args.models_dir, "model_meta.json")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    meta["modelModes"]["ciclo"] = {
        "label": "Ciclo completo (abr–oct)", "nFeatures": len(CICLO_FEATURES), "recommended": False,
        "rmse": m["rmse"], "mae": m["mae"], "r2": m["r2"], "newStateRmse": m_state["rmse"], "newStateR2": m_state["r2"],
        "rmseByRegion": rmse_state, "ic90Coverage": fmt(cov, 3),
        "needs": "La lluvia CHIRPS de las tres etapas del ciclo abril–octubre (emergencia-macollamiento, encañado y espigado-llenado). "
                 "No usa índices satelitales.",
        "importance": importance,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("OK", meta["modelModes"]["ciclo"]["rmse"], importance)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default=os.path.join(here, "..", "02_datos_procesados", "features_completo.csv"))
    ap.add_argument("--models-dir", default=os.path.join(here, "..", "..", "backend", "models"))
    main(ap.parse_args())