import argparse
import json
import os
import warnings

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNetCV, LassoCV, RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
SEED = 42
N_BLOCKS = 12          
N_FOLDS = 5
N_REPS = 6             
TARGET = "rendimiento_t_ha"
PRECIP = "precip_acum_emergencia_macollamiento_mm"
RF_PARAMS = dict(n_estimators=300, max_depth=4, min_samples_leaf=4, max_features=1.0, random_state=SEED, n_jobs=-1)   

PROD_PARAMS = dict(n_estimators=300, max_depth=2, min_samples_leaf=8, max_features=1.0, random_state=SEED, n_jobs=-1)
PROD_FEATURES = ["precip_acum_emergencia_macollamiento_mm"]

OPEN_FEATURES = [
    "precip_acum_emergencia_macollamiento_mm", "bas_n_obs_ciclo", "bas_lai_espigado_llenado",
    "bas_ndti_emergencia_macollamiento", "bas_sti_encanado", "bas_ndvi_emergencia_macollamiento",
    "bas_ndwi_espigado_llenado", "bas_ndti_encanado", "bas_evi_emergencia_macollamiento", "bas_evi_encanado",
]
LABELS = {
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
WINDOWS = {"emergencia_macollamiento": "emergencia-macollamiento", "encanado": "encañado", "espigado_llenado": "espigado-llenado"}
NON_FEATURE = ["ID_POLIGONO", "Cultivo", "Municipio", "Estado", "CONJUNTO", "area_ha_shp", "area_ha", TARGET, "lat", "lng"]

NOT_LIVE = ("pro_", "fapar", "vi6t", "mra", "nddi", "enddi")

def planet_label(f):
    if f in LABELS:
        return LABELS[f]
    _, idx, win = f.split("_", 2)
    return f"{idx.upper()} Planet en {WINDOWS[win]}"

def fmt(x, n=3):
    return round(float(x), n)

def rf():
    return RandomForestRegressor(**RF_PARAMS)

def algorithms():
    return {
        "Random Forest": ("ensamble", rf),
        "XGBoost": ("boosting", lambda: xgb.XGBRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8,
                                                          colsample_bytree=0.8, random_state=SEED, verbosity=0)),
        "LightGBM": ("boosting", lambda: lgb.LGBMRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8,
                                                           colsample_bytree=0.8, random_state=SEED, verbosity=-1, min_child_samples=5)),
        "Lasso": ("baseline", lambda: LassoCV(alphas=np.logspace(-3, 1, 50), max_iter=10000, random_state=SEED)),
        "ElasticNet": ("baseline", lambda: ElasticNetCV(alphas=np.logspace(-3, 1, 30), l1_ratio=[.1, .3, .5, .7, .9], max_iter=10000, random_state=SEED)),
        "Ridge": ("baseline", lambda: RidgeCV(alphas=np.logspace(-3, 3, 50))),
    }

def prep(train_df, test_df, cols):
    imp = SimpleImputer(strategy="median")
    sc = StandardScaler()
    a = sc.fit_transform(imp.fit_transform(train_df[cols]))
    b = sc.transform(imp.transform(test_df[cols]))
    return a, b

def block_splits(df, rep):
    
    groups = KMeans(N_BLOCKS, n_init=3, random_state=rep).fit_predict(df[["lat", "lng"]].values)
    return list(GroupKFold(n_splits=N_FOLDS).split(df, groups=groups))

def state_splits(df):
    out = []
    for st in df["Estado"].unique():
        te = np.where(df["Estado"].values == st)[0]
        out.append((np.where(df["Estado"].values != st)[0], te))
    return out

def oof_predictions(df, splits_per_rep, predict_fold):
    
    P = np.full((len(splits_per_rep), len(df)), np.nan)
    for r, splits in enumerate(splits_per_rep):
        for tr, te in splits:
            P[r, te] = predict_fold(df.iloc[tr], df.iloc[te])
    return P

def metrics(y, P):
    rm = [np.sqrt(mean_squared_error(y, p)) for p in P]
    return {"rmse": fmt(np.mean(rm)), "rmse_sd": fmt(np.std(rm)), "mae": fmt(np.mean([mean_absolute_error(y, p) for p in P])),
            "r2": fmt(np.mean([r2_score(y, p) for p in P]))}

def fixed_fold(cols, make=rf):
    def go(tr, te):
        a, b = prep(tr, te, cols)
        return make().fit(a, tr[TARGET].values).predict(b)
    return go

def infold_topk_fold(pool, k, make=rf, record=None):
    
    def go(tr, te):
        a, b = prep(tr, te, pool)
        r = RandomForestRegressor(n_estimators=200, max_depth=4, min_samples_leaf=4, random_state=0, n_jobs=-1).fit(a, tr[TARGET].values)
        idx = np.argsort(-r.feature_importances_)[:k]
        if record is not None:
            record.append([pool[i] for i in idx])
        return make().fit(a[:, idx], tr[TARGET].values).predict(b[:, idx])
    return go

def state_mean_fold(tr, te):
    m = tr.groupby("Estado")[TARGET].mean()
    return te["Estado"].map(m).values

def by_state(y, est, P):
    R = y[None, :] - P
    return {s: fmt(np.sqrt(np.mean(R[:, est == s] ** 2))) for s in sorted(set(est))}

def forced_topk_fold(pool, k, make, forced=PRECIP):
    
    others = [c for c in pool if c != forced]

    def go(tr, te):
        cols = [forced]
        if k > 1:
            a, _ = prep(tr, te, others)
            r = RandomForestRegressor(n_estimators=200, max_depth=4, min_samples_leaf=4, random_state=0, n_jobs=-1).fit(a, tr[TARGET].values)
            cols += [others[i] for i in np.argsort(-r.feature_importances_)[: k - 1]]
        a, b = prep(tr, te, cols)
        return make().fit(a, tr[TARGET].values).predict(b)
    return go

def prod_rf():
    return RandomForestRegressor(**PROD_PARAMS)

def main(args):
    os.makedirs(args.results_dir, exist_ok=True)
    os.makedirs(args.models_dir, exist_ok=True)
    full = pd.read_csv(args.features)
    train = full[full["CONJUNTO"] == "ENTRENAMIENTO"].reset_index(drop=True)
    y = train[TARGET].values
    est = train["Estado"].values
    all_feats = [c for c in full.columns if c not in NON_FEATURE]
    live_feats = [c for c in all_feats if not any(p in c for p in NOT_LIVE)]
    planet_feats = [PRECIP] + [f"pro_{i}_{w}" for w in WINDOWS for i in ("ndvi", "evi", "lai", "msavi")]
    print(f"{len(train)} parcelas de entrenamiento | {len(all_feats)} variables | {len(live_feats)} abiertas")

    blocks = [block_splits(train, r) for r in range(N_REPS)]
    cv = lambda splits, fn: oof_predictions(train, splits, fn)  
    states = [state_splits(train)]
    prod_fold = fixed_fold(PROD_FEATURES, prod_rf)

    
    print("\n[1/6] Modelo en producción, referencia y modelo anterior bajo cada validación...")
    P_prod = cv(blocks, prod_fold)
    P_base = cv(blocks, state_mean_fold)
    chosen = []
    P_old = cv(blocks, infold_topk_fold(live_feats, 10, record=chosen))          
    P_old_fixed = cv(blocks, fixed_fold(OPEN_FEATURES))                           
    m_prod, m_base, m_old, m_old_fixed = (metrics(y, P) for P in (P_prod, P_base, P_old, P_old_fixed))
    m_prod_state = metrics(y, cv(states, prod_fold))
    m_old_state = metrics(y, cv(states, infold_topk_fold(live_feats, 10)))
    for k, m in (("producción (lluvia, RF prof. 2)", m_prod), ("promedio por estado", m_base), ("10 variables elegidas en cada partición", m_old),
                 ("10 variables fijas (optimista)", m_old_fixed), ("producción, estado nuevo", m_prod_state), ("10 variables, estado nuevo", m_old_state)):
        print(f"  {k:40s}{m}")
    freq = pd.Series([f for sel in chosen for f in sel]).value_counts() / len(chosen)
    stability = {f: fmt(freq.get(f, 0), 2) for f in OPEN_FEATURES}
    ym = pd.Series(y).groupby(est).transform("mean").values
    within_r2 = fmt(np.mean([1 - ((y - p) ** 2).sum() / ((y - ym) ** 2).sum() for p in P_prod]))

    
    print("\n[2/6] Comparación de algoritmos (misma variable: lluvia temprana)...")
    algo_rows = []
    for name, (kind, make) in algorithms().items():
        make_ = prod_rf if name == "Random Forest" else make
        m = metrics(y, cv(blocks, fixed_fold(PROD_FEATURES, make_)))
        algo_rows.append({"model": name, "rmse": m["rmse"], "mae": m["mae"], "r2": m["r2"], "type": kind})
        print(f"  {name:14s} {m}")
    algo_rows.sort(key=lambda r: r["rmse"])
    pd.DataFrame(algo_rows).to_csv(os.path.join(args.results_dir, "comparacion_algoritmos.csv"), index=False)

    
    print("\n[3/6] Búsqueda del número de variables...")
    count_rows = []
    for k in [1, 2, 3, 5, 10, 20, len(live_feats)]:
        m = metrics(y, cv(blocks, forced_topk_fold(live_feats, k, prod_rf)))
        count_rows.append({"nFeatures": k, "rmse": m["rmse"], "r2": m["r2"]})
        print(f"  lluvia + {k - 1:2d} más  {m}")
    pd.DataFrame(count_rows).to_csv(os.path.join(args.results_dir, "busqueda_n_variables.csv"), index=False)

    
    print("\n[4/6] Etapas del modelo y variables extra...")
    m_all = metrics(y, cv(blocks, fixed_fold(all_feats)))
    stages = [
        {"title": "Todas las variables", "nFeatures": len(all_feats), "rmse": m_all["rmse"], "r2": m_all["r2"],
         "detail": "Punto de partida: índices satelitales por etapa del ciclo (incluida Planet), clima y terreno. Con 138 parcelas el modelo se dispersa."},
        {"title": "10 variables elegidas", "nFeatures": 10, "rmse": m_old["rmse"], "r2": m_old["r2"],
         "detail": "Las 10 que más aportan, elegidas dentro de cada partición para no inflar el resultado. Casi igual que usar todas: la elección cambia de una partición a otra."},
        {"title": "Solo la lluvia temprana", "nFeatures": 1, "rmse": m_prod["rmse"], "r2": m_prod["r2"],
         "detail": "Una sola variable y un modelo poco profundo. Es el más preciso y el más estable en la validación, así que es el que se ejecuta."},
    ]
    extra_sets = [
        ("Lluvia temprana (modelo actual)", "", []),
        ("+ Las 10 variables anteriores", "Satélite y lluvia", [c for c in OPEN_FEATURES if c != PRECIP]),
        ("+ NDVI de pico del ciclo", "Satélite", ["bas_ndvi_pico_ciclo"]),
        ("+ LAI en espigado-llenado", "Satélite", ["bas_lai_espigado_llenado"]),
        ("+ Elevación y pendiente", "Topografía", ["elevacion_m", "pendiente_grados"]),
        ("+ Temperatura (Tmax, Tmin, GDD)", "Clima", ["tmax_media_ciclo", "tmin_media_ciclo", "gdd_acumulado_ciclo"]),
        ("+ Lluvia de encañado y espigado", "Clima", ["precip_acum_encanado_mm", "precip_acum_espigado_llenado_mm"]),
        ("+ Coordenadas (lat/lng)", "Ubicación", ["lat", "lng"]),
    ]
    extra_rows, base = [], None
    for name, group, add in extra_sets:
        m = metrics(y, cv(blocks, fixed_fold(PROD_FEATURES + add, prod_rf)))
        base = base or m
        delta = fmt(m["r2"] - base["r2"])
        verdict = "Referencia" if not add else ("Mejora" if delta > 0.02 else "Empeora" if delta < -0.02 else "Sin mejora")
        extra_rows.append({"variant": name, "group": group, "nFeatures": 1 + len(add), "r2": m["r2"], "rmse": m["rmse"], "deltaR2": delta, "verdict": verdict})
        print(f"  {name:36s} R2={m['r2']:.3f} RMSE={m['rmse']:.3f}  {verdict}")
    pd.DataFrame(extra_rows).to_csv(os.path.join(args.results_dir, "variables_extra.csv"), index=False)

    
    print("\n[5/6] Modelo con Planet (solo evaluación)...")
    P_planet = cv(blocks, fixed_fold(planet_feats))
    m_planet = metrics(y, P_planet)
    m_planet_state = metrics(y, cv(states, fixed_fold(planet_feats)))
    P_planet_prod = cv(blocks, fixed_fold(planet_feats, prod_rf))
    m_planet_shallow = metrics(y, P_planet_prod)
    print("  Planet RF estándar", m_planet, "| RF poco profundo", m_planet_shallow, "| estado nuevo", m_planet_state)

    
    print("\n[6/6] Ajuste final y exportación...")
    res = (y[None, :] - P_prod).ravel()
    res_state = {st: (y[None, :] - P_prod)[:, est == st].ravel() for st in sorted(set(est))}
    rmse_state = by_state(y, est, P_prod)
    imp = SimpleImputer(strategy="median").fit(train[PROD_FEATURES])
    sc = StandardScaler().fit(imp.transform(train[PROD_FEATURES]))
    X = pd.DataFrame(sc.transform(imp.transform(train[PROD_FEATURES])), columns=PROD_FEATURES)
    model = prod_rf().fit(X, y)
    labels = {PRECIP: LABELS[PRECIP]}
    joblib.dump({"model": model, "imputer": imp, "scaler": sc, "feature_order": PROD_FEATURES, "required_features": PROD_FEATURES,
                 "feature_labels": labels, "rmse_by_region": rmse_state, "overall_rmse": float(np.sqrt(np.mean(res ** 2))),
                 "residuals_oof": res, "residuals_by_state": res_state, "model_name": "Random Forest"},
                os.path.join(args.models_dir, "model_artifact.joblib"))
    
    
    res_b = (y[None, :] - P_old).ravel()
    res_b_state = {st: (y[None, :] - P_old)[:, est == st].ravel() for st in sorted(set(est))}
    rmse_b_state = by_state(y, est, P_old)
    imp_b = SimpleImputer(strategy="median").fit(train[OPEN_FEATURES])
    sc_b = StandardScaler().fit(imp_b.transform(train[OPEN_FEATURES]))
    Xb = pd.DataFrame(sc_b.transform(imp_b.transform(train[OPEN_FEATURES])), columns=OPEN_FEATURES)
    model_b = rf().fit(Xb, y)
    joblib.dump({"model": model_b, "imputer": imp_b, "scaler": sc_b, "feature_order": OPEN_FEATURES, "required_features": [PRECIP],
                 "feature_labels": {k: LABELS[k] for k in OPEN_FEATURES}, "rmse_by_region": rmse_b_state,
                 "overall_rmse": float(np.sqrt(np.mean(res_b ** 2))), "residuals_oof": res_b, "residuals_by_state": res_b_state,
                 "model_name": "Random Forest"}, os.path.join(args.models_dir, "model_artifact_10var.joblib"))
    Xball = pd.DataFrame(sc_b.transform(imp_b.transform(full[OPEN_FEATURES])), columns=OPEN_FEATURES)
    sv_b = shap.TreeExplainer(model_b)(Xball).values
    importance_b = sorted(
        ({"key": k, "feature": LABELS[k], "value": fmt(np.abs(sv_b[:, j]).mean()), "direction": "positivo" if sv_b[:, j].mean() >= 0 else "negativo"}
         for j, k in enumerate(OPEN_FEATURES)), key=lambda r: -r["value"])
    qs_b = {st: np.quantile(r, [0.05, 0.95]) for st, r in res_b_state.items()}
    cov_b = float(np.mean(np.concatenate([(r >= qs_b[st][0]) & (r <= qs_b[st][1]) for st, r in res_b_state.items()])))
    planet_artifact = os.path.join(args.models_dir, "model_artifact_planet.joblib")
    if os.path.exists(planet_artifact):
        os.remove(planet_artifact)   

    Xall = pd.DataFrame(sc.transform(imp.transform(full[PROD_FEATURES])), columns=PROD_FEATURES)
    sv = shap.TreeExplainer(model)(Xall).values
    importance = [{"key": PRECIP, "feature": LABELS[PRECIP], "value": fmt(np.abs(sv[:, 0]).mean()), "direction": "positivo" if sv[:, 0].mean() >= 0 else "negativo"}]

    pred = full[full["CONJUNTO"] == "PREDICCION"].reset_index(drop=True)
    pp = model.predict(sc.transform(imp.transform(pred[PROD_FEATURES])))
    qs = {st: np.quantile(r, [0.05, 0.95]) for st, r in res_state.items()}
    q_all = np.quantile(res, [0.05, 0.95])
    IC_INFLATION = 1.3   
    lo = np.array([pp[i] + IC_INFLATION * qs.get(e, q_all)[0] for i, e in enumerate(pred["Estado"])])
    hi = np.array([pp[i] + IC_INFLATION * qs.get(e, q_all)[1] for i, e in enumerate(pred["Estado"])])
    pd.DataFrame({"ID_POLIGONO": pred["ID_POLIGONO"], "Estado": pred["Estado"], "Municipio": pred["Municipio"],
                  "rendimiento_t_ha": np.round(pp, 2), "ic90_inferior": np.round(lo, 2), "ic90_superior": np.round(hi, 2)}
                 ).to_csv(os.path.join(args.results_dir, "predicciones_finales.csv"), index=False)
    cov_state = {st: fmt(np.mean((r >= qs[st][0]) & (r <= qs[st][1])), 3) for st, r in res_state.items()}
    cov = float(np.mean(np.concatenate([(r >= qs[st][0]) & (r <= qs[st][1]) for st, r in res_state.items()])))
    bias = {s: fmt((y[None, :] - P_prod)[:, est == s].mean()) for s in sorted(set(est))}

    n_train, n_pred = len(train), len(pred)
    reg_txt = ", ".join(f"{s} {v:.2f} t/ha" for s, v in sorted(rmse_state.items(), key=lambda kv: kv[1]))
    gain = fmt(m_base["rmse"] - m_prod["rmse"], 2)
    plan_gain = fmt(m_prod["rmse"] - m_planet["rmse"], 2)

    meta = {
        "modelSummary": {
            "selected": "Random Forest (lluvia temprana)", "modelName": "Random Forest", "nFeatures": 1,
            "trainingParcels": n_train, "evaluationParcels": n_pred, "shapParcels": len(full),
            "validation": "Validación por bloques espaciales de parcelas cercanas",
            "rmse": m_prod["rmse"], "mae": m_prod["mae"], "r2": m_prod["r2"],
        },
        "algorithmComparison": algo_rows,
        "rmseByRegion": [{"region": s, "rmse": v} for s, v in sorted(rmse_state.items(), key=lambda kv: kv[1])],
        "globalImportance": importance,
        "featureGroups": [{"group": "Variable del modelo", "color": "ndvi", "features": [LABELS[PRECIP]]}],
        "dataSources": [
            {"name": "CHIRPS", "detail": "Precipitación mensual acumulada (~5 km) para Hidalgo, Puebla y Tlaxcala. De aquí sale la única variable del modelo: la lluvia de abril–mayo.", "use": "Predicción"},
            {"name": "Sentinel-2 / Landsat", "detail": "Dataset Básico del reto (2022-2025): NDVI, EVI, LAI, NDWI y otros índices. Se calculan y muestran como contexto de la parcela; en la validación no mejoraron la predicción.", "use": "Contexto"},
            {"name": "CHIRTS-ERA5 e INEGI CEM 4.0", "detail": "Temperatura mínima/máxima, elevación y pendiente. Se probaron y no mejoraron el modelo.", "use": "Evaluación"},
            {"name": "Reto AgroCebada 2026 (FIRA)", "detail": f"Rendimiento observado (t/ha) de {n_train} parcelas de entrenamiento, agricultura de temporal, ciclo abril-octubre 2025.", "use": "Entrenamiento"},
        ],
        "validationSteps": [
            {"title": "Bloques espaciales", "detail": f"Las {n_train} parcelas se agrupan por cercanía en {N_BLOCKS} bloques; en cada vuelta se deja fuera un bloque completo, así ninguna parcela se evalúa con vecinas en el entrenamiento. Se repite {N_REPS} veces con bloques distintos."},
            {"title": "Comparación con una referencia simple", "detail": f"Predecir el promedio del estado da RMSE {m_base['rmse']:.2f} t/ha; el modelo da {m_prod['rmse']:.2f}. La diferencia ({gain:.2f} t/ha) es lo que aporta la lluvia dentro de cada estado."},
            {"title": "Selección sin fuga de información", "detail": f"Al elegir variables, la elección se rehace dentro de cada partición. Con las 10 variables anteriores así elegidas el RMSE es {m_old['rmse']:.2f}; elegirlas con todos los datos daría {m_old_fixed['rmse']:.2f}, una cifra inflada."},
            {"title": "Prueba de estado nuevo", "detail": f"Si se deja un estado completo fuera, el RMSE es {m_prod_state['rmse']:.2f} t/ha (R² {m_prod_state['r2']:.2f}). Indica cuánto se degrada en una región sin parcelas de entrenamiento."},
            {"title": "Margen de error por estado", "detail": f"RMSE por estado: {reg_txt}. El intervalo del 90 % se arma con los errores fuera de muestra de cada estado y en la validación cubrió {cov * 100:.0f} % de las parcelas."},
        ],
        "guidingQuestions": [
            {"question": "¿Qué variables satelitales y climáticas explican mejor el rendimiento?",
             "answer": f"La lluvia acumulada en emergencia-macollamiento (abril–mayo). Usada sola da RMSE {m_prod['rmse']:.2f} t/ha, contra {m_base['rmse']:.2f} de predecir el promedio del estado. Ninguna combinación de índices satelitales (NDVI, EVI, LAI, NDWI…), temperatura o terreno mejoró ese resultado con validación honesta; agregarlos lo empeoró (RMSE {m_old['rmse']:.2f} con 10 variables)."},
            {"question": "¿En qué etapa del ciclo es más crítico monitorear la parcela?",
             "answer": "Emergencia-macollamiento (abril–mayo): es la ventana de la lluvia que determina la predicción. La lluvia de encañado y espigado-llenado no aportó."},
            {"question": "¿Cómo se traduce la predicción en una decisión de crédito replicable?",
             "answer": "Cada parcela recibe un rendimiento esperado con un margen de error igual al RMSE fuera de muestra de su estado, y un score 0-100 que es la probabilidad de alcanzar el rendimiento de referencia. El score alimenta un semáforo de elegibilidad."},
            {"question": "¿Qué tan confiable es el modelo hoy?",
             "answer": f"Con validación por bloques espaciales el RMSE es {m_prod['rmse']:.2f} t/ha y el R² {m_prod['r2']:.2f}; el intervalo del 90 % cubrió {cov * 100:.0f} %. Para un estado sin parcelas de entrenamiento el RMSE sube a {m_prod_state['rmse']:.2f}. Es una referencia de riesgo, no una cifra exacta de cosecha."},
        ],
        "buildProcess": {
            "pipeline": [
                {"title": "Datos de origen", "detail": "197 parcelas, lluvia CHIRPS, imágenes Sentinel-2 y Landsat 2022-2025, temperatura y terreno."},
                {"title": "Ventanas del ciclo", "detail": "Cada variable se resume por etapa del cultivo: emergencia-macollamiento, encañado y espigado-llenado."},
                {"title": "Evaluación de variables", "detail": "Se probaron índices satelitales, temperatura, terreno y lluvia de otras etapas con la misma validación."},
                {"title": "Validación espacial", "detail": "Se dejan fuera bloques de parcelas cercanas para medir cómo predice en lugares que no vio."},
                {"title": "Predicción en vivo", "detail": "Para una parcela dibujada se calcula la lluvia de abril–mayo con CHIRPS y se ejecuta el modelo."},
            ],
            "stages": stages,
            "featureCountSearch": count_rows,
            "extraVariables": extra_rows,
            "extraVariablesNote": f"Mismas particiones y {N_REPS} repeticiones. Una variación de R² menor a ±0.02 es ruido con {n_train} parcelas.",
            "limitations": [
                {"title": "El modelo se basa en la lluvia", "detail": f"La precipitación en emergencia-macollamiento es la única variable. Va ligada al estado (en Tlaxcala llueve más y se rinde menos) y CHIRPS tiene unos 5 km de resolución, así que distingue zonas, no parcelas vecinas. Dentro de un mismo estado el modelo explica poca variación adicional (R² intra-estado {within_r2:.2f}, medido contra el promedio real de cada estado)."},
                {"title": "Los índices satelitales no mejoraron la predicción", "detail": f"Con {n_train} parcelas, ninguna combinación de índices de Sentinel-2/Landsat o Planet superó a la lluvia sola. Se muestran como contexto de la parcela, no como parte de la estimación."},
                {"title": "Solo se validó en Hidalgo, Puebla y Tlaxcala", "detail": f"Fuera de esos estados no hay evidencia: al dejar un estado completo fuera el RMSE es {m_prod_state['rmse']:.2f} t/ha."},
                {"title": "Es una referencia de riesgo, no una cosecha exacta", "detail": f"Con {n_train} parcelas de entrenamiento el R² es de alrededor de {m_prod['r2']:.2f}. Sirve para comparar parcelas y orientar decisiones de crédito, no para fijar una cifra de cosecha."},
                {"title": "Sesgo por estado", "detail": f"En la validación el modelo sobreestima Hidalgo y Tlaxcala y subestima Puebla (sesgo medio {', '.join(f'{k} {v:+.2f}' for k, v in bias.items())} t/ha, error real menos predicho). El intervalo por estado lo recoge."},
                {"title": "Ventanas del ciclo supuestas", "detail": "El dataset no trae fechas de siembra ni de cosecha, así que las etapas se fijaron en el ciclo abril-octubre. Conviene contrastarlas con boletines agronómicos."},
            ],
        },
        "validationDetail": {
            "primary": m_prod, "newState": m_prod_state, "stateMeanBaseline": m_base, "previous10Variables": m_old,
            "previous10VariablesOptimistic": m_old_fixed, "previous10VariablesNewState": m_old_state,
            "withinStateR2": within_r2, "ic90Coverage": fmt(cov, 3), "ic90CoverageByState": cov_state, "biasByState": bias,
            "selectionStabilityPrevious10": stability, "blocks": N_BLOCKS, "folds": N_FOLDS, "repetitions": N_REPS,
        },
    }
    meta["modelModes"] = {
        "default": "lluvia",
        "lluvia": {
            "label": "Solo lluvia", "nFeatures": 1, "recommended": True,
            "rmse": m_prod["rmse"], "mae": m_prod["mae"], "r2": m_prod["r2"], "newStateRmse": m_prod_state["rmse"], "newStateR2": m_prod_state["r2"],
            "rmseByRegion": rmse_state, "ic90Coverage": fmt(cov, 3),
            "needs": "Solo la lluvia de abril–mayo (CHIRPS).",
            "importance": importance,
        },
        "10var": {
            "label": "10 variables (Plan B)", "nFeatures": len(OPEN_FEATURES), "recommended": False,
            "rmse": m_old["rmse"], "mae": m_old["mae"], "r2": m_old["r2"], "newStateRmse": m_old_state["rmse"], "newStateR2": m_old_state["r2"],
            "rmseByRegion": rmse_b_state, "ic90Coverage": fmt(cov_b, 3),
            "needs": "La lluvia de abril–mayo y los índices Sentinel-2/Landsat de la parcela (LAI, NDVI, NDTI, STI, NDWI, EVI, nº de observaciones). Si falta alguno se rellena con la mediana de entrenamiento y se avisa.",
            "importance": importance_b,
        },
    }
    with open(os.path.join(args.models_dir, "model_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    planet_meta = {
        "nFeatures": len(planet_feats), "nPlanet": len(planet_feats) - 1, "trainingParcels": n_train, "validation": "Bloques espaciales",
        "rmse": m_planet["rmse"], "mae": m_planet["mae"], "r2": m_planet["r2"],
        "baseline": {"rmse": m_prod["rmse"], "mae": m_prod["mae"], "r2": m_prod["r2"], "nFeatures": 1},
        "rmseByRegion": by_state(y, est, P_planet), "features": [planet_label(f) for f in planet_feats],
        "globalImportance": [], "inProduction": False,
        "note": f"Evaluación, no se usa en producción. Lluvia + 12 variables Planet: RMSE {m_planet['rmse']:.2f} t/ha. La lluvia sola, {m_prod['rmse']:.2f}: Planet no mejora la precisión ({plan_gain:+.2f} t/ha). Por eso un CSV de Planet se ejecuta con el mismo modelo de lluvia y sus índices se muestran como contexto.",
    }
    with open(os.path.join(args.models_dir, "model_planet_meta.json"), "w", encoding="utf-8") as f:
        json.dump(planet_meta, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.results_dir, "resumen_validacion.json"), "w", encoding="utf-8") as f:
        json.dump({**meta["validationDetail"], "planet": m_planet, "planetShallow": m_planet_shallow, "planetNewState": m_planet_state}, f, ensure_ascii=False, indent=2)

    print("\nListo.")
    print(f"  RMSE reportado {m_prod['rmse']} t/ha, R² {m_prod['r2']} | por estado {rmse_state}")
    print(f"  IC90 cobertura {cov:.3f} por estado {cov_state} | sesgo por estado {bias} | R² intra-estado {within_r2}")

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default=os.path.join(here, "..", "02_datos_procesados", "features_completo.csv"))
    ap.add_argument("--models-dir", default=os.path.join(here, "..", "..", "backend", "models"))
    ap.add_argument("--results-dir", default=os.path.join(here, "resultados_FINAL"))
    main(ap.parse_args())