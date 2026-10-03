# Reto AgroCebada FIRA 2026 — Pipeline y modelo (carpeta `ml/` de CEBIX)

## Mapa

```
ml/README.md                       <- este archivo
ml/GUIA_GOOGLE_EARTH_ENGINE.md     <- tarea para el compañero (features en vivo, gratis)
ml/01_pipeline_features/           dataset crudo -> tabla de features (una fila por parcela)
ml/02_datos_procesados/            features_train / features_predict / features_completo (CSV)
ml/03_modelo/                      entrenamiento, validación espacial, SHAP (3 rondas)
                                   + build_model_meta.py (genera backend/model_meta.json)
ml/04_entrega_final/               make_submission.py -> CSV que se manda a FIRA
ml/build_example_csv.py            genera backend/data/ejemplo_features_predict.csv (con lat/lng)
backend/                           API FastAPI que ejecuta el modelo EN VIVO (+ export_model.py)
src/                               frontend: consume la API, sin datos del modelo fijos
```

## Resultado final del modelo

**Random Forest, 10 features, sin Planet — RMSE 0.642 t/ha, MAE 0.489, R² 0.426**
(validación espacial leave-region-out sobre las 138 parcelas de entrenamiento: en cada
iteración se deja fuera un estado completo — Hidalgo, Puebla o Tlaxcala).

RMSE por estado excluido: Tlaxcala 0.435 · Hidalgo 0.619 · Puebla 0.725.

### Cómo se llegó (narrativa para el reporte técnico)

| Ronda | Qué se hizo | Mejor modelo | RMSE | R² |
|---|---|---|---|---|
| 1 | Baseline con las 97 features | Random Forest | 0.740 | 0.240 |
| 2 | Selección por SHAP (top-15, incluía 3 de Planet) | Random Forest | 0.645 | 0.422 |
| 3 (**FINAL**) | Selección por SHAP **sin Planet ni índices no reproducibles** (top-10 de 68) | Random Forest | **0.642** | **0.426** |

1. Con 97 features y 138 parcelas había sobreajuste. Rankear por SHAP y quedarse con un
   subconjunto casi duplicó el R² (0.24 -> 0.42), validado siempre con la misma
   leave-region-out.
2. **Decisión de presupuesto cero:** se excluyó todo lo que no se puede reproducir con
   fuentes gratuitas (Planet, que es de pago; FAPAR, VI6T, MRA y NDDI/ENDDI, difíciles o
   no reproducibles exactos). El resultado fue igual o ligeramente mejor, y ahora las 10
   variables se pueden recalcular en vivo con Google Earth Engine.

### Las 10 variables finales

precipitación en emergencia-macollamiento · densidad de observaciones (nº de escenas) ·
LAI espigado-llenado · NDTI emergencia-macollamiento · STI encañado · NDVI
emergencia-macollamiento · NDWI espigado-llenado · NDTI encañado · EVI
emergencia-macollamiento · EVI encañado.

Respuesta a las **preguntas guía de FIRA** (dan bonus): la variable con más peso es, por
mucho, la precipitación temprana (emergencia-macollamiento; SHAP ≈ 0.65 vs ≈ 0.05 de la
siguiente); entre los índices, LAI (espigado-llenado) va primero (≈0.054), seguido de NDTI, NDWI, EVI y STI con pesos similares (≈0.03–0.04); la
ventana más informativa es emergencia-macollamiento (4 de 10 variables).

## Cómo correr todo

```bash
# 1) Features (necesita el dataset de FIRA descomprimido)
pip install -r 01_pipeline_features/requirements.txt
python 01_pipeline_features/build_features.py --data-dir /ruta/DATASET_RETO_AGRO_2026 --out-dir ./output

# 2) Modelo (las 3 rondas; la 3 es la final)
pip install xgboost lightgbm shap scikit-learn
python 03_modelo/train_model.py --train output/features_train.csv --predict output/features_predict.csv --out-dir ./modelo
python 03_modelo/select_features.py --train output/features_train.csv --predict output/features_predict.csv --out-dir ./modelo_v2
python 03_modelo/select_features_sin_planet.py --train output/features_train.csv --predict output/features_predict.csv --out-dir ./modelo_sin_planet

# 3) CSV de entrega a FIRA (usa las predicciones de la ronda 3)
python 04_entrega_final/make_submission.py \
    --predictions modelo_sin_planet/predicciones_finales.csv \
    --features-predict output/features_predict.csv --team NOMBRE_DE_TU_EQUIPO
```

Los scripts de `03_modelo/` importan entre sí (`train_model.py`): déjalos en la misma
carpeta. Ya vienen los resultados de las 3 rondas en `03_modelo/resultados_*`.

## Entrega a FIRA (checklist)

- [ ] Subir a la plataforma del reto: reporte técnico (estructura y límites de palabras
      de las bases), app/dashboard con enlace, código fuente + documentación, video ≤ 5 min.
- [ ] Enviar a **innovacion@fira.gob.mx** el CSV `nombre_del_equipo_prediccion.csv`
      (generado con `make_submission.py`, que valida las 59 parcelas).
- [ ] Si se usó IA: indicar dónde y **anexar los prompts** (lo exigen las bases).
- [ ] Fecha límite: **19 de octubre de 2026, 23:59**.

## Supuesto más importante — declararlo en el reporte

El dataset no trae fechas de siembra/cosecha. Se asumieron ventanas fenológicas fijas en
el ciclo abril–octubre 2025: emergencia-macollamiento (abr–may), encañado (jun–jul),
espigado-llenado (ago–sep). Editable en `PHENO_WINDOWS` de `build_features.py`; conviene
respaldarlo con literatura/boletines agronómicos (SIAP, INIFAP).

## Decisiones metodológicas (mencionarlas en Metodología)

- Nubosidad: se descartan observaciones con > 40% (umbral sugerido por FIRA).
- Agregación por ventana: **mediana** de las observaciones (robusta a nubes residuales).
- Clima: muestreo zonal con `all_touched=True` (parcelas 0.35–64 ha vs píxeles ~5 km).
- GDD aproximado con temperatura mensual (`max(0, Tmedia − 4°C) × 30`); ya no entra al
  modelo final pero sí a la tabla de features.
- Intervalo de confianza 90% por bootstrap de residuales out-of-fold.
- Agricultura de temporal confirmada por FIRA (sin riego) -> el clima es el driver central.
- NDDI/ENDDI usan NDVI/NDWI remuestreados a 8 bits (nota del PDF de FIRA): no son el
  mismo NDVI de `ndvi_promedio`. Además LAI de Sentinel-2 (log vía SAVI) y de Planet
  (lineal) son definiciones distintas.

## Limitaciones a declarar honestamente (el jurado las puede detectar)

1. **La precipitación en emergencia-macollamiento domina el modelo y está parcialmente
   confundida con el estado**: Tlaxcala llueve más (≈212 mm vs ≈126–137 mm) y rinde menos
   (≈3.0 vs 3.8–4.5 t/ha), y CHIRPS (~5 km) no distingue bien entre parcelas cercanas. La
   validación leave-region-out mitiga (el modelo sí generaliza al estado excluido, R²≈0.43)
   pero no elimina el efecto. Mejora futura: clima de mayor resolución o estaciones.
2. **`bas_n_obs_ciclo` (nº de escenas válidas) no es una variable agronómica**, es de
   calidad/densidad del dato satelital. Se revisó que no codifique el estado (medias
   similares entre estados), pero hay que explicarla como lo que es.
3. **R² ≈ 0.43 con 138 parcelas**: es una referencia de riesgo relativo, no una cifra
   exacta de cosecha. Decirlo así de claro suma credibilidad.

## Ejecución en vivo

- `backend/`: **backend real**. Carga el modelo y lo ejecuta en cada request (`/predict-csv`,
  `/predict`). Probado end-to-end: al mandarle el CSV de las 59 parcelas de evaluación, las
  predicciones coinciden **exacto (0 diferencias)** con las calculadas offline. Esto responde a
  "aplicación que permita ejecutar el modelo predictivo" de las bases.
- El frontend ya no trae datos precalculados: métricas y SHAP global vienen de `GET /model-info`
  (generado por `03_modelo/build_model_meta.py` a partir de los resultados reales), y las
  predicciones de `POST /predict-csv`.
- **Pendiente (tarea del compañero):** `GUIA_GOOGLE_EARTH_ENGINE.md` — calcular las 10
  features en vivo para una geometría nueva, para poder predecir parcelas fuera del
  dataset. Todo con fuentes gratuitas.

## Regenerar los artefactos del backend

```bash
python backend/export_model.py                       # model_artifact.joblib
python ml/03_modelo/build_model_meta.py              # model_meta.json
python ml/build_example_csv.py --shapefile /ruta/Parcelas_Reto_AGC_CONJUNTO.shp   # CSV de ejemplo
```
