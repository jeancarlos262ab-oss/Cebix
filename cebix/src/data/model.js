/**
 * Todos los valores de este archivo provienen del modelo real entrenado sobre las
 * 138 parcelas de ENTRENAMIENTO del Reto AgroCebada 2026 (ver 03_modelo/train_model.py
 * y 03_modelo/select_features.py del paquete de modelado).
 *
 * Proceso en dos rondas:
 *  1. Baseline con las 97 features construidas por build_features.py (Sentinel-2/Landsat
 *     BÁSICO + Planet PRO, en 3 ventanas fenológicas; CHIRPS+CHIRTS-ERA5; INEGI CEM 4.0):
 *     mejor modelo Random Forest, RMSE=0.740, R²=0.240 (leave-region-out).
 *  2. Selección de features por importancia SHAP, EXCLUYENDO todas las features de Planet
 *     (API de pago, no disponible para el equipo): 10/15/20/25/30/40/50 candidatos,
 *     validados todos con la misma leave-region-out: el subconjunto de 10 features dio
 *     el mejor resultado, RMSE=0.642, R²=0.426 — el que se reporta abajo.
 *
 * Validación espacial (leave-region-out): en cada iteración se deja fuera un estado
 * completo (Hidalgo, Puebla o Tlaxcala) y se entrena solo con los otros dos, para medir
 * qué tan bien generaliza el modelo a una región que nunca vio.
 *
 * Limitación conocida (declarada también en el reporte técnico): la variable más
 * importante, precipitación en emergencia-macollamiento, está parcialmente confundida
 * con el estado (Tlaxcala llueve más y rinde menos) por la resolución de CHIRPS (~5 km).
 * La validación leave-region-out mitiga pero no elimina este efecto.
 */

export const featureGroups = [
  {
    group: "Variables seleccionadas por SHAP (top 10 de 68, sin Planet ni índices no reproducibles)",
    color: "ndvi",
    features: ["Precipitación en emergencia-macollamiento", "Densidad de observaciones válidas (Sentinel-2/Landsat)", "LAI en espigado-llenado", "NDTI en emergencia-macollamiento", "STI en encañado", "NDVI en emergencia-macollamiento", "NDWI en espigado-llenado", "NDTI en encañado", "EVI en emergencia-macollamiento", "EVI en encañado"],
  },
];

// RMSE, MAE y R² son el resultado real de validación espacial leave-region-out
// (predicciones out-of-fold concatenadas de las 138 parcelas de entrenamiento).
export const algorithmComparison = [
  { model: "Ridge", rmse: 0.821, mae: 0.691, r2: 0.062, type: "baseline" },
  { model: "Lasso", rmse: 0.775, mae: 0.642, r2: 0.164, type: "baseline" },
  { model: "ElasticNet", rmse: 0.782, mae: 0.654, r2: 0.15, type: "baseline" },
  { model: "Random Forest", rmse: 0.642, mae: 0.489, r2: 0.426, type: "ensamble" },
  { model: "XGBoost", rmse: 0.766, mae: 0.625, r2: 0.185, type: "boosting" },
  { model: "LightGBM", rmse: 0.817, mae: 0.655, r2: 0.073, type: "boosting" },
];

export const modelSummary = {
  selected: "Random Forest (top-10 features SHAP, sin Planet)",
  trainingParcels: 138,
  validation: "Validación espacial por bloques (leave-region-out)",
  rmse: 0.642,
  mae: 0.489,
  r2: 0.426,
};

// RMSE por estado excluido en la validación leave-region-out (modelo final).
export const rmseByRegion = [
  { region: "Tlaxcala", rmse: 0.435 },
  { region: "Hidalgo", rmse: 0.619 },
  { region: "Puebla", rmse: 0.725 },
];

export const dataSources = [
  {
    name: "Sentinel-2 / Landsat",
    detail:
      "Dataset Básico (Sentinel-2 + Landsat, 2022-2025) del reto: NDVI, EVI, LAI, NDWI y otros índices por parcela y fecha. El dataset PRO (Planet, de pago) se excluyó del modelo final: no cambió el desempeño y no es reproducible con fuentes gratuitas.",
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
    name: "Reto AgroCebada 2026 (FIRA)",
    detail: "Rendimiento observado (t/ha) de 138 parcelas de entrenamiento, agricultura de temporal, ciclo abril-octubre 2025.",
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
    title: "Selección de features por SHAP",
    detail:
      "De 68 features candidatas (solo índices reproducibles con fuentes gratuitas), se probaron subconjuntos de tamaño 10 a 50 rankeados por importancia SHAP; el top-10 dio el mejor RMSE bajo la misma validación espacial (0.740 con las 97 features -> 0.642), evidencia de que el modelo con todas las features sobreajustaba.",
  },
  {
    title: "Métrica por bloque",
    detail:
      "RMSE por estado excluido: Tlaxcala 0.43 t/ha, Hidalgo 0.62 t/ha, Puebla 0.72 t/ha. El promedio global (0.64 t/ha) es el que se reporta como RMSE del modelo.",
  },
];

export const guidingQuestions = [
  {
    question: "¿Qué variables satelitales y climáticas explican mejor el rendimiento?",
    answer:
      "Según SHAP, Precipitación en emergencia-macollamiento, Densidad de observaciones válidas (Sentinel-2/Landsat), LAI en espigado-llenado, NDTI en emergencia-macollamiento, STI en encañado concentran la mayor contribución. La precipitación temprana (emergencia-macollamiento) domina, aunque está parcialmente confundida con el estado por la resolución de CHIRPS (~5 km) — ver limitación en Metodología.",
  },
  {
    question: "¿En qué etapa del ciclo es más crítico monitorear la parcela?",
    answer:
      "Emergencia-macollamiento (abril-mayo): 4 de las 10 variables seleccionadas por SHAP corresponden a esta ventana (más que encañado con 3 o espigado-llenado con 2), y la precipitación de esta ventana domina la importancia global.",
  },
  {
    question: "¿Cómo se traduce la predicción en una decisión de crédito replicable?",
    answer:
      "Cada parcela recibe un rendimiento esperado con un margen de error igual al RMSE de validación espacial de su estado, y un score 0-100 que alimenta un semáforo de elegibilidad.",
  },
  {
    question: "¿Qué tan confiable es el modelo hoy?",
    answer:
      "Bajo validación espacial estricta (dejar un estado completo fuera), el modelo elegido alcanza R²=0.43 y RMSE=0.64 t/ha tras seleccionar las 10 features más relevantes (sin usar Planet) (antes de seleccionar features, R² era 0.24). Sigue siendo una referencia de riesgo relativo, no una cifra exacta de cosecha.",
  },
];
