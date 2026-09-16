/**
 * Importancia global (media de |SHAP|) por variable, agregada sobre las 138
 * parcelas de ENTRENAMIENTO + 59 de PREDICCION, calculada con shap.LinearExplainer
 * sobre el modelo final (Ridge, alpha=5, features estandarizadas). direction indica
 * el signo del coeficiente de esa variable en el modelo.
 */
export const globalImportance = [
  { feature: "Temperatura mínima media (ciclo)", value: 0.259, direction: "positivo" },
  { feature: "Temperatura máxima media (ciclo)", value: 0.243, direction: "negativo" },
  { feature: "Grados-día de crecimiento (GDD)", value: 0.166, direction: "positivo" },
  { feature: "Precipitación acumulada (ciclo)", value: 0.15, direction: "negativo" },
  { feature: "Pendiente del terreno", value: 0.135, direction: "positivo" },
  { feature: "NDWI en emergencia-macollamiento", value: 0.085, direction: "negativo" },
  { feature: "EVI en encañado", value: 0.031, direction: "positivo" },
  { feature: "Elevación de la parcela", value: 0.027, direction: "negativo" },
  { feature: "LAI en espigado-llenado", value: 0.026, direction: "negativo" },
  { feature: "NDVI en encañado", value: 0.022, direction: "positivo" },
  { feature: "NDVI pico del ciclo", value: 0.018, direction: "negativo" },
  { feature: "NDVI en espigado-llenado", value: 0.004, direction: "positivo" },
];