/**
 * Importancia global (media de |SHAP|) por variable, agregada sobre las 138
 * parcelas de ENTRENAMIENTO + 59 de PREDICCION, calculada con shap.TreeExplainer
 * sobre el modelo final (Random Forest, top-10 features seleccionadas por SHAP, sin Planet —
 * ver select_features_sin_planet.py). direction indica el signo promedio de la contribución
 * SHAP de esa variable sobre el rendimiento estimado.
 */
export const globalImportance = [
  { feature: "Precipitación en emergencia-macollamiento", value: 0.652, direction: "positivo" },
  { feature: "LAI en espigado-llenado", value: 0.054, direction: "positivo" },
  { feature: "Densidad de observaciones válidas (Sentinel-2/Landsat)", value: 0.049, direction: "negativo" },
  { feature: "NDTI en emergencia-macollamiento", value: 0.038, direction: "negativo" },
  { feature: "NDWI en espigado-llenado", value: 0.031, direction: "negativo" },
  { feature: "EVI en encañado", value: 0.029, direction: "negativo" },
  { feature: "STI en encañado", value: 0.029, direction: "positivo" },
  { feature: "EVI en emergencia-macollamiento", value: 0.021, direction: "negativo" },
  { feature: "NDVI en emergencia-macollamiento", value: 0.02, direction: "negativo" },
  { feature: "NDTI en encañado", value: 0.017, direction: "positivo" },
];
