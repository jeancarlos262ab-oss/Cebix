"""
Entrena y exporta el modelo CON Planet (Random Forest) a models/model_artifact_planet.joblib y escribe su resumen
en models/model_planet_meta.json (lo lee el backend; no hace falta tocar model_meta.json).

Es autocontenido: parte de los CSV oficiales del reto, sin el paquete ml/ original.
  1. Variables: lluvia abr–may (tabla de referencia) + 12 de Planet (NDVI, EVI, LAI y MSAVI en tres etapas). Es el
     modelo que se usa cuando la persona sube SOLO el CSV PRO, así que no usa variables de Sentinel-2 ni de Landsat.
  2. Sin selección de variables: con 13 candidatas y 138 parcelas se usan todas.
  3. Validación: leave-region-out (cada estado fuera una vez); el modelo abierto de referencia se evalúa igual.
  4. Se serializa con la misma estructura que model_artifact.joblib (imputer, scaler, rmse por región, residuos OOF).

Uso (desde backend/):
    python scripts/export_model_planet.py --dir ../DataSet/DATASET_RETO_AGRO_2026
"""
import argparse, json, os, sys
import joblib, numpy as np, pandas as pd, shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__)); BACKEND = os.path.dirname(HERE); sys.path.insert(0, BACKEND)
from app.services import official_dataset as od  # noqa: E402

PR = "precip_acum_emergencia_macollamiento_mm"
K = 13
SEEDS = range(5)
RF = dict(n_estimators=300, max_depth=4, min_samples_leaf=4, max_features=1.0, random_state=42)
OPEN = json.load(open(os.path.join(BACKEND, "models", "model_meta.json"), encoding="utf-8"))  # solo para consistencia
OPEN_FEATURES = joblib.load(os.path.join(BACKEND, "models", "model_artifact.joblib"))["feature_order"]
OPEN_LABELS = joblib.load(os.path.join(BACKEND, "models", "model_artifact.joblib"))["feature_labels"]

WIN = {"emergencia_macollamiento": "emergencia-macollamiento", "encanado": "encañado", "espigado_llenado": "espigado-llenado"}
def label(f):
    if f in OPEN_LABELS:
        return OPEN_LABELS[f]
    _, ix, w = f.split("_", 2)
    return f"{ix.upper()} Planet en {WIN[w]}"


def load(d):
    basico = pd.read_csv(os.path.join(d, "Conjunto_datos_BASICO_AgroCebada2026.csv"), encoding="utf-8-sig")
    pro = pd.read_csv(os.path.join(d, "Conjunto_datos_PRO_AgroCebada.csv"), encoding="utf-8-sig")
    y = pd.read_csv(os.path.join(d, "ID_area_rendimiento_70_30_Reto_AgroCebada.csv"), encoding="utf-8-sig").iloc[:, :4].set_index("ID_POLIGONO")
    df = od.features_from_basico(basico).set_index("ID_POLIGONO").join(od.planet_features(pro).set_index("ID_POLIGONO")[od.PLANET_FEATURES]).join(y[["RENDIMIENTO_T_HA"]])
    return df[df["CONJUNTO"] == "ENTRENAMIENTO"].copy()


def top_k(Xt, yt, k, seed):
    imp = RandomForestRegressor(**{**RF, "random_state": seed}).fit(Xt, yt).feature_importances_
    return np.argsort(imp)[::-1][:k]


def nested_cv(tr, pool, k, seed):
    oof = pd.Series(index=tr.index, dtype=float)
    for st in tr["Estado"].unique():
        t, v = tr[tr["Estado"] != st], tr[tr["Estado"] == st]
        im = SimpleImputer(strategy="median").fit(t[pool]); Xt = im.transform(t[pool])
        idx = top_k(Xt, t["RENDIMIENTO_T_HA"], k, seed)
        m = RandomForestRegressor(**{**RF, "random_state": seed}).fit(Xt[:, idx], t["RENDIMIENTO_T_HA"])
        oof[v.index] = m.predict(im.transform(v[pool])[:, idx])
    return oof


def main(d):
    tr = load(d); y = tr["RENDIMIENTO_T_HA"]
    pool = [PR] + od.PLANET_FEATURES
    ms = np.array([[np.sqrt(mean_squared_error(y, o)), mean_absolute_error(y, o), r2_score(y, o)] for o in (nested_cv(tr, pool, K, s) for s in SEEDS)]).mean(axis=0)
    base = np.array([[np.sqrt(mean_squared_error(y, o)), mean_absolute_error(y, o), r2_score(y, o)] for o in (nested_cv(tr, OPEN_FEATURES, 10, s) for s in SEEDS)]).mean(axis=0)

    im = SimpleImputer(strategy="median").fit(tr[pool]); Xi = im.transform(tr[pool])
    idx = top_k(Xi, y, K, RF["random_state"]); feats = [pool[i] for i in idx]
    imputer = SimpleImputer(strategy="median").fit(tr[feats]); scaler = StandardScaler().fit(imputer.transform(tr[feats]))
    X = pd.DataFrame(scaler.transform(imputer.transform(tr[feats])), columns=feats)
    model = RandomForestRegressor(**RF).fit(X, y)

    oof = nested_cv(tr, pool, K, RF["random_state"]); res = (y - oof).values
    by_region = {st: float(np.sqrt(mean_squared_error(y[tr["Estado"] == st], oof[tr["Estado"] == st]))) for st in tr["Estado"].unique()}
    sv = np.abs(shap.TreeExplainer(model)(X).values).mean(axis=0)
    importance = sorted(({"feature": label(f), "value": round(float(v), 3)} for f, v in zip(feats, sv)), key=lambda r: -r["value"])
    n_planet = sum(f.startswith("pro_") for f in feats)  # 12

    joblib.dump({"model": model, "imputer": imputer, "scaler": scaler, "feature_order": feats,
                 "feature_labels": {f: label(f) for f in feats}, "rmse_by_region": by_region,
                 "overall_rmse": float(np.sqrt(mean_squared_error(y, oof))), "residuals_oof": res,
                 "model_name": "Random Forest + Planet"}, os.path.join(BACKEND, "models", "model_artifact_planet.joblib"))
    meta = {"nFeatures": K, "nPlanet": n_planet, "trainingParcels": int(len(tr)), "validation": "Leave-region-out",
            "rmse": round(float(ms[0]), 3), "mae": round(float(ms[1]), 3), "r2": round(float(ms[2]), 3),
            "baseline": {"rmse": round(float(base[0]), 3), "mae": round(float(base[1]), 3), "r2": round(float(base[2]), 3), "nFeatures": 10},
            "rmseByRegion": {k: round(v, 3) for k, v in by_region.items()}, "features": [label(f) for f in feats], "globalImportance": importance,
            "note": "Promedio de 5 semillas del Random Forest. Se usa cuando se sube solo el CSV PRO: lluvia abr–may de la tabla de referencia + 12 variables Planet."}
    json.dump(meta, open(os.path.join(BACKEND, "models", "model_planet_meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--dir", required=True); main(ap.parse_args().dir)
