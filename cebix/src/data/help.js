/**
 * Preguntas guía para el botón de información (InfoButton) de las pantallas
 * que no tienen su propio archivo de datos. Mismo formato que
 * `guidingQuestions` en src/data/model.js.
 */

export const predictionsGuidingQuestions = [
  {
    question: "¿Cómo se calcula el rendimiento esperado y su margen de error?",
    answer:
      "Para parcelas de predicción es la salida del modelo final (Ridge) entrenado con las 138 parcelas de entrenamiento. El margen (±ton/ha) es el RMSE de validación espacial leave-region-out del estado de esa parcela: Hidalgo 0.85, Puebla 0.72, Tlaxcala 0.72.",
  },
  {
    question: "¿Qué es el score de elegibilidad y el semáforo?",
    answer:
      "Un valor de 0 a 100 que combina el rendimiento esperado, el vigor NDVI y la estabilidad de la predicción (menor margen de error = más confianza). Verde (≥70) es elegible, amarillo (45-69) va a revisión manual y rojo (<45) es alto riesgo.",
  },
  {
    question: "¿Qué muestra la gráfica de variables que más influyeron?",
    answer:
      "El SHAP local de esa parcela: sus 4 variables con mayor contribución a la predicción. El color de acento suma al rendimiento esperado, el rojo resta, y el largo de la barra es la magnitud del efecto.",
  },
  {
    question: "¿Qué pasa cuando envío la parcela a comité de crédito?",
    answer:
      "Se guarda la fecha de envío y se genera un reporte en PDF con el rendimiento, el score, el semáforo y las variables SHAP de esa parcela, listo para descargar o reenviar.",
  },
];

export const parcelsGuidingQuestions = [
  {
    question: "¿Qué diferencia hay entre las parcelas del reto y las que yo agrego?",
    answer:
      "Las 197 parcelas del Reto AgroCebada 2026 (138 de entrenamiento, 59 de predicción) son de solo lectura: vienen del dataset validado y no se pueden editar ni borrar. Las que agregas a mano o por CSV sí son editables y viven solo en tu navegador.",
  },
  {
    question: "¿Cómo se calculan el score y el semáforo de las parcelas que agrego?",
    answer:
      "Con una heurística explícita a partir de tus datos: rendimiento esperado normalizado, vigor NDVI y estabilidad según tu margen de error. Su SHAP local se estima comparando NDVI, precipitación y GDD de tu parcela contra el promedio de las parcelas del reto.",
  },
  {
    question: "¿Cómo subo parcelas por CSV?",
    answer:
      "Arrastra o selecciona un CSV con nombre, municipio, región, superficie, NDVI, EVI, precipitación y GDD ya calculados. Cada fila se agrega como una parcela nueva, con score y semáforo calculados automáticamente.",
  },
  {
    question: "¿Qué significa el resumen de elegibilidad?",
    answer:
      "Cuenta, sobre las parcelas filtradas por región, cuántas caen en cada color del semáforo: verde (elegibles), amarillo (revisión manual) y rojo (alto riesgo).",
  },
];

export const mapGuidingQuestions = [
  {
    question: "¿Qué imagen de fondo tiene el mapa?",
    answer:
      "Una capa satelital de Hidalgo, Tlaxcala y Puebla, procesada en Google Earth Engine a partir de las mismas escenas Sentinel-2 que alimentan el NDVI, EVI, LAI y NDWI del modelo.",
  },
  {
    question: "¿Qué representa cada pin del mapa?",
    answer:
      "Una parcela evaluada. El color sigue el mismo semáforo de elegibilidad que el resto de la app: verde elegible, amarillo revisión manual, rojo alto riesgo. Toca un pin para verla resaltada.",
  },
  {
    question: "¿Qué significa \"Regiones cubiertas\"?",
    answer:
      "El total de parcelas activas con imagen procesada, desglosado por estado (Hidalgo, Puebla, Tlaxcala), incluyendo las que hayas agregado tú.",
  },
];
