"""
Sección `buildProcess` de model_meta.json: cómo se construyó el modelo (etapas, búsqueda del número de variables,
variables extra probadas, límites). Sale de los resultados guardados en esta carpeta; el frontend solo la muestra.

Uso (agrega/actualiza la sección en un model_meta.json ya generado):
    python process_meta.py --patch ../../backend/models/model_meta.json
"""
import argparse
import json
import os

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


def build_process():
    s3 = pd.read_csv(os.path.join(HERE, "resultados_3_FINAL_top10_sin_planet", "busqueda_n_features_sin_planet.csv"))
    s2 = pd.read_csv(os.path.join(HERE, "resultados_2_intermedio_top15_con_planet", "busqueda_n_features.csv"))
    s1 = pd.read_csv(os.path.join(HERE, "resultados_1_baseline_97_features", "algorithm_comparison.csv"))
    extra = pd.read_csv(os.path.join(HERE, "resultados_4_variables_extra", "prueba_variables_extra.csv"))

    rf1 = s1[s1["model"] == "Random Forest"].iloc[0]
    rf2 = s2[(s2["model"] == "Random Forest") & (s2["n_features"] == 15)].iloc[0]
    rf3 = s3[(s3["model"] == "Random Forest") & (s3["n_features"] == 10)].iloc[0]
    search = s3[s3["model"] == "Random Forest"].sort_values("n_features")
    base = extra.iloc[0]

    stages = [
        {
            "title": "Todas las variables",
            "nFeatures": 97,
            "rmse": round(float(rf1["rmse"]), 3),
            "r2": round(float(rf1["r2"]), 3),
            "detail": "Punto de partida: los índices satelitales por ventana del ciclo, el clima y el terreno. Con 138 parcelas y 97 variables el modelo sobreajustaba.",
        },
        {
            "title": "Selección por importancia SHAP",
            "nFeatures": 15,
            "rmse": round(float(rf2["rmse"]), 3),
            "r2": round(float(rf2["r2"]), 3),
            "detail": "Se ordenaron las variables por su aporte (SHAP) y se conservaron las 15 principales. El R² casi se duplicó, pero entraron variables de Planet, que es de pago.",
        },
        {
            "title": "Solo fuentes abiertas",
            "nFeatures": 10,
            "rmse": round(float(rf3["rmse"]), 3),
            "r2": round(float(rf3["r2"]), 3),
            "detail": "Se quitó todo lo que no se puede recalcular con datos gratuitos y se volvió a seleccionar. Quedó igual de preciso, y ahora las 10 variables se calculan en vivo para cualquier parcela.",
        },
    ]

    extra_rows = []
    for _, r in extra.iterrows():
        delta = float(r["r2"] - base["r2"])
        extra_rows.append(
            {
                "variant": r["variante"],
                "group": r["grupo"] if isinstance(r["grupo"], str) else "",
                "nFeatures": int(r["n_features"]),
                "r2": round(float(r["r2"]), 3),
                "rmse": round(float(r["rmse"]), 3),
                "deltaR2": round(delta, 3),
                "verdict": "Referencia" if r["variante"] == base["variante"] else ("Empeora" if delta < -0.03 else "Sin mejora"),
            }
        )

    return {
        "pipeline": [
            {"title": "Datos del reto", "detail": "197 parcelas, imágenes Sentinel-2 y Landsat 2022-2025, lluvia CHIRPS, temperatura y terreno."},
            {"title": "Ventanas del ciclo", "detail": "Cada índice se resume por etapa del cultivo: emergencia-macollamiento, encañado y espigado-llenado."},
            {"title": "Selección de variables", "detail": "Se conservan solo las que más aportan, medido con SHAP y validado por estado."},
            {"title": "Validación espacial", "detail": "Cada estado se deja fuera una vez para medir qué tan bien predice una región que no vio."},
            {"title": "Predicción en vivo", "detail": "Para una parcela dibujada se calculan las 10 variables desde imágenes satelitales y se ejecuta el modelo."},
        ],
        "stages": stages,
        "featureCountSearch": [
            {"nFeatures": int(r["n_features"]), "r2": round(float(r["r2"]), 3), "rmse": round(float(r["rmse"]), 3)}
            for _, r in search.iterrows()
        ],
        "extraVariables": extra_rows,
        "extraVariablesNote": "Probadas con la misma validación por estado y promediando 10 semillas del Random Forest. La variación entre semillas es de ±0.02 de R².",
        "limitations": [
            {
                "title": "La lluvia temprana domina el modelo",
                "detail": "La precipitación en emergencia-macollamiento explica la mayor parte de la predicción y va ligada al estado: en Tlaxcala llueve más y se rinde menos. CHIRPS tiene una resolución de unos 5 km y no distingue bien entre parcelas cercanas.",
            },
            {
                "title": "Una variable mide la calidad del dato",
                "detail": "La densidad de observaciones válidas cuenta cuántas escenas limpias hay en el ciclo; no es una variable agronómica. Se revisó que no codifique el estado, pero hay que leerla como lo que es.",
            },
            {
                "title": "Es una referencia de riesgo, no una cosecha exacta",
                "detail": "Con 138 parcelas de entrenamiento el R² es de alrededor de 0.43. Sirve para comparar parcelas entre sí y orientar decisiones de crédito, no para fijar una cifra de cosecha.",
            },
            {
                "title": "Ventanas del ciclo supuestas",
                "detail": "El dataset no trae fechas de siembra ni de cosecha, así que las etapas del cultivo se fijaron en el ciclo abril-octubre. Conviene contrastarlas con boletines agronómicos.",
            },
        ],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch", required=True, help="model_meta.json a actualizar")
    a = ap.parse_args()
    meta = json.load(open(a.patch, encoding="utf-8"))
    meta["buildProcess"] = build_process()
    with open(a.patch, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("buildProcess escrito en", a.patch)
