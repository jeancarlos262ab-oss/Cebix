# Reto AgroCebada FIRA 2026 — Pipeline y modelo (carpeta `ml/` de CEBIX)

Actualizado con el dataset oficial completo (incluye los `.tif` de lluvia, temperatura y terreno). Todo se regenera con
dos comandos y todas las cifras que muestra el dashboard salen de esa corrida.

## Mapa

```
ml/01_pipeline_features/build_features.py   dataset oficial -> tabla de features (una fila por parcela, con lat/lng)
ml/02_datos_procesados/                     features_completo / _train / _predict (CSV)
ml/03_modelo/entrenar_y_validar.py          ÚNICO script de modelo: valida, entrena, exporta artefactos y metadatos
ml/03_modelo/resultados_FINAL/              CSV/JSON de la última corrida (comparación, búsqueda, variables extra, predicciones)
ml/04_entrega_final/make_submission.py      CSV que se manda a FIRA (valida las 59 parcelas)
ml/build_example_csv.py                     genera backend/data/ejemplo_features_predict.csv
ml/historico/                               scripts y resultados de rondas anteriores (NO usar, ver "Qué cambió")
backend/                                    API FastAPI que ejecuta los modelos en vivo
```

## Cómo correr todo

```bash
pip install -r 01_pipeline_features/requirements.txt xgboost lightgbm shap scikit-learn==1.8.0

# 1) Features (el dataset oficial descomprimido: shapefile, CSV Básico/PRO, CHIRPS, temperatura, topografía)
python 01_pipeline_features/build_features.py --data-dir /ruta/DATASET_RETO_AGRO_2026 --out-dir 02_datos_procesados

# 2) Modelos + validación + metadatos (≈4 min). Escribe backend/models/*.joblib y *_meta.json
python 03_modelo/entrenar_y_validar.py

# 3) Entrega a FIRA
python 04_entrega_final/make_submission.py --predictions 03_modelo/resultados_FINAL/predicciones_finales.csv \
    --features-predict 02_datos_procesados/features_predict.csv --team NOMBRE_DE_TU_EQUIPO
```

Verificado: el pipeline reproduce **exacto** (diferencia 0) los `features_*.csv` anteriores con el dataset oficial, la lluvia coincide con
la tabla de referencia del backend (`parcelas_oficiales.csv`, diferencia < 1e-5) y los centroides lat/lng coinciden exacto.

## Resultado (validación honesta)

**Modelo en producción: Random Forest poco profundo (profundidad 2) sobre una sola variable, la lluvia CHIRPS acumulada en
emergencia-macollamiento (abril–mayo).** Se llegó por evidencia: con validación honesta ninguna combinación de índices
satelitales, temperatura, terreno o lluvia de otras etapas le gana a la lluvia sola; añadir las 10 variables que se usaban antes
la iguala en el mejor caso y la empeora cuando la elección de variables se hace dentro de la validación.

| Medida | RMSE t/ha | R² |
|---|---|---|
| **Modelo en producción**, bloques espaciales (cifra reportada) | **0.54** | **0.60** |
| Referencia ingenua: promedio del estado | 0.73 | 0.26 |
| Modelo anterior (10 variables elegidas dentro de cada partición) | 0.62 | 0.47 |
| Modelo anterior con las 10 variables fijas (optimista: la elección vio todos los datos) | 0.52 | 0.62 |
| Estado nuevo (se deja un estado completo fuera): producción | 0.62 | 0.47 |
| Estado nuevo: modelo anterior de 10 variables | 0.77 | 0.19 |
| Lluvia + 12 variables Planet, bloques espaciales (no se usa) | 0.55 | 0.59 |

Error por estado (margen de error y semáforo): Tlaxcala 0.40, Hidalgo 0.54, Puebla 0.59 t/ha. El IC del 90 % usa los residuos
fuera de muestra de cada estado y cubrió 90 % (89.7–89.8 % por estado). Sesgo medio por estado (real − predicho): Hidalgo −0.10,
Puebla +0.05, Tlaxcala −0.08 t/ha. R² intra-estado: 0.20 (contra el promedio real de cada estado).

### Qué cambió respecto a la versión anterior (y por qué las cifras no son comparables)

1. **Validación.** Antes: dejar un estado completo fuera (leave-region-out). Ahora: bloques espaciales (k-means sobre lat/lng,
   12 bloques, 5 folds, 6 repeticiones); el estado nuevo queda como prueba de estrés. Las 59 parcelas a predecir son una muestra
   al azar de los mismos 3 estados (15/29/15, igual que el entrenamiento). Un k-fold al azar infla el resultado porque el vecino
   más cercano de cada parcela está a ~0.4 km.
2. **Selección de variables sin fuga.** Antes las 10 variables se elegían con SHAP sobre las 138 parcelas y luego se validaba
   con esas mismas parcelas. Rehecha dentro de cada partición, el RMSE pasa de 0.52 a 0.62; solo la lluvia se elige en el 100 %
   de las particiones y el resto es inestable (10–80 %).
3. **Modelo.** De 10 variables a la lluvia temprana (arriba). En particiones nuevas, la lluvia con Random Forest de profundidad 2
   fue la mejor entre ocho alternativas tanto en bloques (0.53) como en estado nuevo (0.62); XGBoost, LightGBM y los lineales
   con la misma variable quedaron peor.
4. **Intervalos calibrados por estado** con los residuos de esta validación. El backend ya no usa sorteos al azar (la misma
   parcela da siempre el mismo intervalo) y **no predice si falta la lluvia** (antes rellenaba con la mediana de entrenamiento).
5. **Planet.** No mejora a la lluvia sola, así que un CSV PRO se ejecuta con el mismo modelo y sus índices quedan como contexto.
   Con el CSV Básico y el PRO una misma parcela da el mismo resultado.
6. **Semáforo** (en el frontend): probabilidad de alcanzar el rendimiento de referencia con el rendimiento estimado y el error
   por estado, sin el NDVI ni pesos fijos.

## Lo que hay que decir con honestidad en el reporte técnico

- **El modelo es de lluvia.** Los índices satelitales se calculan y se muestran como contexto de la parcela, pero con 138 parcelas
  no demostraron mejorar la predicción (tabla `resultados_FINAL/variables_extra.csv`: NDVI de pico, LAI, elevación, pendiente,
  temperatura, lluvia de otras etapas y coordenadas no mejoran; varias empeoran).
- **La lluvia (CHIRPS ~5 km) distingue zonas, no parcelas vecinas**, y va ligada al estado: Tlaxcala llueve más (~214 mm contra
  ~127–138) y rinde menos (~3.0 contra 3.8–4.5 t/ha). Dentro de un estado el modelo explica poco (R² intra-estado 0.20).
- **Solo hay evidencia en Hidalgo, Puebla y Tlaxcala**: en un estado sin parcelas de entrenamiento el RMSE es 0.62.
- Hay sesgo por estado en la validación; el intervalo por estado lo recoge.
- R² ≈ 0.60 con 138 parcelas: referencia de riesgo relativo, no una cifra exacta de cosecha.
- La elección del modelo se hizo con estas mismas 138 parcelas (pocas alternativas y una sola variable, así que el optimismo
  residual es pequeño, pero no es cero).

## Supuestos y decisiones metodológicas

- **Ventanas fenológicas fijas** (el dataset no trae fechas de siembra/cosecha): emergencia-macollamiento abr–may, encañado
  jun–jul, espigado-llenado ago–sep. Editables en `PHENO_WINDOWS` de `build_features.py`; conviene respaldarlas con SIAP/INIFAP.
- Nubosidad: se descartan observaciones con > 40 %. Agregación por ventana: **mediana**.
- Clima: muestreo zonal con `all_touched=True` (parcelas 0.35–64 ha contra píxeles de ~5 km). GDD aproximado con temperatura mensual.
- Índices: las ecuaciones de Sentinel-2 del backend (NDVI, EVI, SAVI, LAI) coinciden con `Ecuaciones_indices_AgroCebada_FIRA_2026`.
  Planet entrega sus índices ya calculados; sus valores no son equivalentes a los de Sentinel-2 (otra resolución y sensor),
  por eso hay un modelo aparte y no se mezclan.
- Planet (de pago), FAPAR, VI6T, MRA y NDDI/ENDDI no entran a ningún modelo en producción (Planet se evaluó y no mejora; los otros no son reproducibles en vivo con fuentes gratuitas).
- Agricultura de temporal confirmada por FIRA (sin riego): el clima es el driver central.

## Entrega a FIRA (checklist)

- [ ] Subir a la plataforma del reto: reporte técnico, app/dashboard con enlace, código fuente + documentación, video ≤ 5 min.
- [ ] Enviar a **innovacion@fira.gob.mx** el CSV `nombre_del_equipo_prediccion.csv` (lo genera `make_submission.py`).
- [ ] Si se usó IA: indicar dónde y **anexar los prompts** (lo exigen las bases).
- [ ] Fecha límite: **19 de octubre de 2026, 23:59**.

## Regenerar otros artefactos del backend

```bash
python ml/build_example_csv.py --shapefile /ruta/Parcelas_Reto_AGC_CONJUNTO.shp   # ejemplo_features_predict.csv
```
`backend/data/parcelas_oficiales.csv` (lluvia abr–may y contexto de las 197 parcelas) sale de `features_completo.csv`
(columnas `precip_acum_emergencia_macollamiento_mm`, `lat`, `lng`, `Estado`, `Municipio`, `area_ha`, `CONJUNTO`).

## Modos de predicción (lluvia / 10 variables)

`entrenar_y_validar.py` exporta dos artefactos y la API los elige con el parámetro `modo` (el front lo guarda y lo envía):

| Modo | Artefacto | Variables | RMSE (bloques espaciales) | R² |
|---|---|---|---|---|
| `lluvia` (por defecto) | `model_artifact.joblib` | lluvia abril–mayo | 0.535 | 0.60 |
| `10var` (Plan B) | `model_artifact_10var.joblib` | lluvia + 9 índices Sentinel-2/Landsat | 0.620 | 0.47 |

- El intervalo del 90 % y el RMSE por estado de cada modo salen de su propia validación fuera de muestra. En el Plan B se usa la validación con selección de variables dentro de cada partición (la cifra honesta), no la de variables fijas (0.523, optimista).
- El Plan B exige la lluvia; si faltan índices satelitales los rellena con la mediana de entrenamiento y la respuesta lista `variables_imputadas`.
- El CSV PRO (Planet) no trae las 10 variables: con `modo=10var` responde 422 con un mensaje claro.
