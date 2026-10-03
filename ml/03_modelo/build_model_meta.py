"""
Reto AgroCebada 2026 — Metadatos del modelo para el dashboard (CEBIX)
=====================================================================

Genera `backend/model_meta.json`, que la API sirve en GET /model-info. Es lo que
reemplaza a los antiguos `src/data/model.js` y `src/data/shap.js` del frontend: ya no
hay cifras escritas a mano en React; todo sale de los resultados REALES del modelo.

De dónde sale cada cosa:
  - RMSE / MAE / R² y comparación de algoritmos  -> resultados_3_FINAL.../model_summary.json
                                                    (validación leave-region-out)
  - RMSE por estado, nombres legibles de features -> backend/model_artifact.joblib
  - Importancia SHAP global (|SHAP| medio + signo) -> se CALCULA aquí con shap.TreeExplainer
                                                    sobre el modelo exportado y las 197 parcelas
  - Nº de parcelas, ventanas fenológicas          -> features_*.csv y nombres de las features
  - Textos (preguntas guía, pasos de validación)  -> plantillas rellenadas con las cifras anteriores

Uso (desde ml/03_modelo):
    python build_model_meta.py
Reejecútalo cada vez que reentrenes el modelo (después de export_model.py).
"""

import argparse
import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd
import shap

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
ALGO_TYPE = {
    "Ridge": "baseline",
    "Lasso": "baseline",
    "ElasticNet": "baseline",
    "Random Forest": "ensamble",
    "XGBoost": "boosting",
    "LightGBM": "boosting",
}
WINDOWS = {
    "emergencia_macollamiento": "Emergencia-macollamiento",
    "encanado": "Encañado",
    "espigado_llenado": "Espigado-llenado",
}


def window_of_key(key):
    for k, label in WINDOWS.items():
        if k in key:
            return label
    return "Todo el ciclo"


def join_es(items):
    items = list(items)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " y " + items[-1]


def compute_global_importance(artifact, features_df):
    """Media de |SHAP| y signo medio por variable, sobre todas las parcelas del reto."""
    order = artifact["feature_order"]
    X = artifact["scaler"].transform(artifact["imputer"].transform(features_df[order]))
    X = pd.DataFrame(X, columns=order)
    values = shap.TreeExplainer(artifact["model"])(X).values
    rows = []
    for j, key in enumerate(order):
        rows.append(
            {
                "key": key,
                "feature": artifact["feature_labels"].get(key, key),
                "value": round(float(np.abs(values[:, j]).mean()), 3),
                "direction": "positivo" if values[:, j].mean() >= 0 else "negativo",
            }
        )
    rows.sort(key=lambda r: -r["value"])
    return rows


def main(args):
    artifact = joblib.load(args.artifact)
    order = artifact["feature_order"]
    labels = artifact["feature_labels"]

    train = pd.read_csv(args.train)
    allp = pd.read_csv(args.features_all)
    n_train, n_eval = len(train), int((allp["CONJUNTO"] != "ENTRENAMIENTO").sum()) if "CONJUNTO" in allp else len(allp) - n_train

    # --- métricas finales (leave-region-out) -------------------------------------------------
    summary = json.load(open(os.path.join(args.results_dir, "model_summary.json"), encoding="utf-8"))
    n_sel = summary["n_features_selected"]
    final_rows = [r for r in summary["cv_metrics_por_n"] if r["n_features"] == n_sel]
    algo = [
        {
            "model": r["model"],
            "rmse": round(r["rmse"], 3),
            "mae": round(r["mae"], 3),
            "r2": round(r["r2"], 3),
            "type": ALGO_TYPE.get(r["model"], "otro"),
        }
        for r in final_rows
    ]
    best = next(r for r in final_rows if r["model"] == artifact["model_name"])
    rmse, mae, r2 = round(best["rmse"], 3), round(best["mae"], 3), round(best["r2"], 3)

    baseline = json.load(open(os.path.join(args.baseline_dir, "model_summary.json"), encoding="utf-8"))
    base_best = next(r for r in baseline["cv_metrics"] if r["model"] == artifact["model_name"])
    n_all_features = baseline["n_features"]
    ranking = pd.read_csv(os.path.join(args.results_dir, "ranking_features_shap_sin_planet.csv"))
    n_candidates = len(ranking)

    rmse_region = sorted(
        ({"region": k, "rmse": round(float(v), 3)} for k, v in artifact["rmse_by_region"].items()),
        key=lambda r: r["rmse"],
    )

    # --- SHAP global (calculado) ---------------------------------------------------------------
    importance = compute_global_importance(artifact, allp)
    top = importance[0]
    total_shap = sum(r["value"] for r in importance) or 1.0

    # --- ventanas fenológicas ----------------------------------------------------------------
    by_window = {}
    for key in order:
        by_window.setdefault(window_of_key(key), []).append(labels.get(key, key))
    pheno_counts = {w: len(by_window.get(w, [])) for w in WINDOWS.values()}
    best_window = max(pheno_counts, key=pheno_counts.get)

    top5 = join_es([r["feature"] for r in importance[:5]])
    region_txt = ", ".join(f"{r['region']} {r['rmse']:.2f} t/ha" for r in rmse_region)
    other_windows = [(w, c) for w, c in pheno_counts.items() if w != best_window]
    others_txt = " o ".join(f"{w} con {c}" for w, c in sorted(other_windows, key=lambda x: -x[1]))

    meta = {
        "modelSummary": {
            "selected": f"{artifact['model_name']} (top-{n_sel} features SHAP, sin Planet)",
            "modelName": artifact["model_name"],
            "nFeatures": n_sel,
            "trainingParcels": n_train,
            "evaluationParcels": n_eval,
            "shapParcels": len(allp),
            "validation": "Validación espacial por bloques (leave-region-out)",
            "rmse": rmse,
            "mae": mae,
            "r2": r2,
        },
        "algorithmComparison": sorted(algo, key=lambda r: r["rmse"]),
        "rmseByRegion": rmse_region,
        "globalImportance": importance,
        "featureGroups": [
            {
                "group": f"Variables seleccionadas por SHAP (top {n_sel} de {n_candidates}, sin Planet ni índices no reproducibles)",
                "color": "ndvi",
                "features": [labels.get(k, k) for k in order],
            }
        ],
        "dataSources": [
            {
                "name": "Sentinel-2 / Landsat",
                "detail": "Dataset Básico (Sentinel-2 + Landsat, 2022-2025) del reto: NDVI, EVI, LAI, NDWI y otros índices por parcela y fecha. El dataset PRO (Planet, de pago) se excluyó del modelo final: no cambió el desempeño y no es reproducible con fuentes gratuitas.",
                "use": "Desarrollo",
            },
            {
                "name": "CHIRPS + CHIRTS-ERA5",
                "detail": "Precipitación mensual acumulada y temperatura mínima/máxima media, en raster para Hidalgo, Puebla y Tlaxcala.",
                "use": "Desarrollo",
            },
            {
                "name": "INEGI - CEM 4.0",
                "detail": "Elevación y pendiente del terreno, resolución 120 m.",
                "use": "Desarrollo",
            },
            {
                "name": "Reto AgroCebada 2026 (FIRA)",
                "detail": f"Rendimiento observado (t/ha) de {n_train} parcelas de entrenamiento, agricultura de temporal, ciclo abril-octubre 2025.",
                "use": "Entrenamiento",
            },
        ],
        "validationSteps": [
            {
                "title": "Bloques por estado",
                "detail": f"Las {n_train} parcelas de entrenamiento se agrupan en {len(rmse_region)} bloques espaciales: {join_es(sorted(r['region'] for r in rmse_region))}.",
            },
            {
                "title": "Leave-region-out",
                "detail": "En cada iteración se deja fuera un estado completo y se entrena solo con los otros dos, para simular qué tan bien predice el modelo sobre una región que nunca vio.",
            },
            {
                "title": "Selección de features por SHAP",
                "detail": f"De {n_candidates} features candidatas (solo índices reproducibles con fuentes gratuitas), se probaron subconjuntos rankeados por importancia SHAP; el top-{n_sel} dio el mejor RMSE bajo la misma validación espacial ({base_best['rmse']:.3f} con las {n_all_features} features -> {rmse:.3f}), evidencia de que el modelo con todas las features sobreajustaba.",
            },
            {
                "title": "Métrica por bloque",
                "detail": f"RMSE por estado excluido: {region_txt}. El promedio global ({rmse:.2f} t/ha) es el que se reporta como RMSE del modelo.",
            },
        ],
        "guidingQuestions": [
            {
                "question": "¿Qué variables satelitales y climáticas explican mejor el rendimiento?",
                "answer": f"Según SHAP, {top5} concentran la mayor contribución. {top['feature']} aporta el {round(top['value'] / total_shap * 100)}% de la importancia total; está parcialmente confundida con el estado por la resolución de CHIRPS (~5 km) — ver limitación en Metodología.",
            },
            {
                "question": "¿En qué etapa del ciclo es más crítico monitorear la parcela?",
                "answer": f"{best_window}: {pheno_counts[best_window]} de las {n_sel} variables seleccionadas por SHAP corresponden a esta ventana (frente a {others_txt}).",
            },
            {
                "question": "¿Cómo se traduce la predicción en una decisión de crédito replicable?",
                "answer": "Cada parcela recibe un rendimiento esperado con un margen de error igual al RMSE de validación espacial de su estado, y un score 0-100 que alimenta un semáforo de elegibilidad.",
            },
            {
                "question": "¿Qué tan confiable es el modelo hoy?",
                "answer": f"Bajo validación espacial estricta (dejar un estado completo fuera), el modelo elegido alcanza R²={r2:.2f} y RMSE={rmse:.2f} t/ha tras seleccionar las {n_sel} features más relevantes (sin usar Planet); antes de seleccionar features, R² era {base_best['r2']:.2f}. Sigue siendo una referencia de riesgo relativo, no una cifra exacta de cosecha.",
            },
        ],
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Metadatos escritos en {args.out}")
    print(f"  {artifact['model_name']}  RMSE={rmse}  MAE={mae}  R2={r2}  | train={n_train} eval={n_eval}")
    print("  SHAP global:", [(r["feature"][:28], r["value"], r["direction"][:3]) for r in importance[:4]], "...")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--artifact", default=os.path.join(HERE, "..", "..", "backend", "model_artifact.joblib"))
    p.add_argument("--train", default=os.path.join(HERE, "..", "02_datos_procesados", "features_train.csv"))
    p.add_argument("--features-all", default=os.path.join(HERE, "..", "02_datos_procesados", "features_completo.csv"))
    p.add_argument("--results-dir", default=os.path.join(HERE, "resultados_3_FINAL_top10_sin_planet"))
    p.add_argument("--baseline-dir", default=os.path.join(HERE, "resultados_1_baseline_97_features"))
    p.add_argument("--out", default=os.path.join(HERE, "..", "..", "backend", "model_meta.json"))
    main(p.parse_args())
