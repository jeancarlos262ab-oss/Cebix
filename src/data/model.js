/**
 * Todos los valores de este archivo provienen de un modelo entrenado sobre las
 * 138 parcelas de ENTRENAMIENTO del Reto AgroCebada 2026, usando:
 *  - NDVI/EVI/LAI/NDWI de Sentinel-2 (Dataset Básico), agregados en 3 ventanas
 *    fenológicas (emergencia-macollamiento, encañado, espigado-llenado) más el
 *    NDVI pico del ciclo, filtrando observaciones con >40% de nubosidad.
 *  - Precipitación acumulada y temperaturas mínima/máxima medias del ciclo
 *    (CHIRPS + CHIRTS-ERA5, abril-octubre 2025) y grados-día de crecimiento
 *    (GDD, base 4°C) derivados de esos mismos rásters.
 *  - Elevación y pendiente del terreno (INEGI CEM 4.0).
 *
 * La validación es espacial (leave-region-out): en cada iteración se deja
 * fuera un estado completo (Hidalgo, Puebla o Tlaxcala) y se entrena solo con
 * los otros dos, para medir qué tan bien generaliza el modelo a una región que
 * nunca vio. Las métricas de "algorithmComparison" y "modelSummary" son el
 * resultado real de esa validación, no del ajuste en entrenamiento.
 */

export const featureGroups = [
  {
    group: "Índices espectrales (Sentinel-2)",
    color: "ndvi",
    features: [
      "NDVI en encañado",
      "NDVI en espigado-llenado",
      "NDVI pico del ciclo",
      "EVI en encañado",
      "LAI en espigado-llenado",
      "NDWI en emergencia-macollamiento",
    ],
  },
  {
    group: "Clima (CHIRPS + CHIRTS-ERA5)",
    color: "brand",
    features: [
      "Precipitación acumulada (ciclo abr-oct 2025)",
      "Temperatura mínima media del ciclo",
      "Temperatura máxima media del ciclo",
      "Grados-día de crecimiento (GDD, base 4°C)",
    ],
  },
  {
    group: "Terreno (INEGI CEM 4.0)",
    color: "navy",
    features: ["Elevación de la parcela", "Pendiente del terreno"],
  },
];

// RMSE, MAE y R² son el resultado real de validación espacial leave-region-out
// (predicciones out-of-fold concatenadas de las 138 parcelas de entrenamiento).
export const algorithmComparison = [
  { model: "Ridge", rmse: 0.76, mae: 0.61, r2: 0.2, type: "baseline" },
  { model: "Lasso", rmse: 0.77, mae: 0.64, r2: 0.18, type: "baseline" },
  { model: "Random Forest", rmse: 1.0, mae: 0.84, r2: -0.38, type: "boosting" },
  { model: "XGBoost", rmse: 0.87, mae: 0.71, r2: -0.04, type: "boosting" },
  { model: "LightGBM", rmse: 0.9, mae: 0.74, r2: -0.11, type: "boosting" },
];

export const modelSummary = {
  selected: "Ridge (regularizado)",
  trainingParcels: 138,
  validation: "Validación espacial por bloques (leave-region-out)",
  rmse: 0.76,
  mae: 0.61,
  r2: 0.2,
};

// RMSE por estado excluido en la validación leave-region-out (Ridge).
export const rmseByRegion = [
  { region: "Hidalgo", rmse: 0.85 },
  { region: "Puebla", rmse: 0.72 },
  { region: "Tlaxcala", rmse: 0.72 },
];

export const dataSources = [
  {
    name: "Sentinel-2 / Landsat",
    detail:
      "Dataset Básico del reto: NDVI, EVI, LAI, NDWI y otros índices por parcela y fecha, 2022-2025.",
    use: "Desarrollo",
  },
  {
    name: "CHIRPS + CHIRTS-ERA5",
    detail:
      "Precipitación mensual acumulada y temperatura mínima/máxima media, en raster para Hidalgo, Puebla y Tlaxcala.",
    use: "Desarrollo",
  },
  {
    name: "INEGI - CEM 4.0",
    detail: "Elevación y pendiente del terreno, resolución 120 m.",
    use: "Desarrollo",
  },
  {
    name: "Reto AgroCebada 2026",
    detail: "Rendimiento observado (t/ha) de 138 parcelas de entrenamiento, ciclo abril-octubre 2025.",
    use: "Entrenamiento",
  },
];

export const validationSteps = [
  {
    title: "Bloques por estado",
    detail:
      "Las 138 parcelas de entrenamiento se agrupan en 3 bloques espaciales: Hidalgo, Puebla y Tlaxcala.",
  },
  {
    title: "Leave-region-out",
    detail:
      "En cada iteración se deja fuera un estado completo y se entrena solo con los otros dos, para simular qué tan bien predice el modelo sobre una región que nunca vio.",
  },
  {
    title: "Métrica por bloque",
    detail:
      "RMSE por estado excluido: Hidalgo 0.85 t/ha, Puebla 0.72 t/ha, Tlaxcala 0.72 t/ha. El promedio global (0.76 t/ha) es el que se reporta como RMSE del modelo.",
  },
  {
    title: "Por qué Ridge y no boosting",
    detail:
      "Bajo esta validación estricta, XGBoost, LightGBM y Random Forest obtienen R² negativo: con solo 3 macro-regiones y 138 filas, sobreajustan patrones que no generalizan a un estado nuevo. Un modelo lineal regularizado (Ridge) es más estable al extrapolar y se eligió como modelo final.",
  },
];

export const guidingQuestions = [
  {
    question: "¿Qué variables satelitales y climáticas explican mejor el rendimiento?",
    answer:
      "Según SHAP, la temperatura mínima y máxima media del ciclo, los grados-día acumulados y la precipitación total concentran la mayor contribución. Entre las variables satelitales, el NDWI temprano y el EVI en encañado aportan la señal más consistente; el NDVI por sí solo (en promedio simple) es más débil de lo esperado.",
  },
  {
    question: "¿En qué etapa del ciclo es más crítico monitorear la parcela?",
    answer:
      "Encañado y espigado-llenado (junio a septiembre): es cuando el NDVI, el EVI y el LAI muestran mayor variabilidad entre parcelas y concentran casi toda la señal espectral útil para el modelo.",
  },
  {
    question: "¿Cómo se traduce la predicción en una decisión de crédito replicable?",
    answer:
      "Cada parcela recibe un rendimiento esperado con un margen de error igual al RMSE de validación espacial de su estado, y un score 0-100 (escalado sobre el rango de rendimiento observado en entrenamiento) que alimenta un semáforo de elegibilidad.",
  },
  {
    question: "¿Qué tan confiable es el modelo hoy?",
    answer:
      "Bajo validación espacial estricta (dejar un estado completo fuera), el modelo elegido alcanza R²=0.20 y RMSE=0.76 t/ha: mejor que una estimación al azar, pero lejos de ser preciso. Con 138 parcelas repartidas en solo 3 estados, el clima y la ubicación están fuertemente confundidos entre sí, así que estas predicciones deben tratarse como una referencia de riesgo relativo, no como una cifra exacta de cosecha.",
  },
];
