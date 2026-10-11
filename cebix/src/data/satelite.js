/**
 * Especificación de las 10 variables que calcula la pantalla «Parcela satelital» (ver
 * ml/GUIA_GOOGLE_EARTH_ENGINE.md y backend/stac_features.py). Aquí NO hay resultados del modelo:
 * solo la definición de qué se calcula, de dónde y en qué ventana.
 */

/** Ventanas fenológicas fijas (iguales a PHENO_WINDOWS de ml/01_pipeline_features/build_features.py). */
export const WINDOWS = {
  emergencia: { label: "Emergencia–macollamiento", range: "1 abr – 31 may" },
  encanado: { label: "Encañado", range: "1 jun – 31 jul" },
  espigado: { label: "Espigado–llenado", range: "1 ago – 30 sep" },
  ciclo: { label: "Ciclo completo", range: "1 abr – 31 oct" },
};

export const SOURCES = {
  s2: { label: "Sentinel-2", short: "S2", dataset: "Sentinel-2 L2A · catálogo abierto Earth Search" },
  chirps: { label: "CHIRPS", short: "CHIRPS", dataset: "CHIRPS v2.0 diario · Climate Hazards Center (UCSB)" },
  scenes: { label: "Sentinel-2 + Landsat 8/9", short: "S2+L", dataset: "Conteo de fechas con escena (nubes ≤ 40 %)" },
};

/** Las 10 features del modelo final, en el orden de la guía. `digits` = decimales al mostrarlas. */
export const SAT_FEATURES = [
  {
    key: "precip_acum_emergencia_macollamiento_mm",
    label: "Precipitación en emergencia-macollamiento",
    unit: "mm",
    source: "chirps",
    window: "emergencia",
    method: "Suma diaria",
    digits: 0,
  },
  {
    key: "bas_n_obs_ciclo",
    label: "Densidad de observaciones válidas (Sentinel-2/Landsat)",
    unit: "fechas",
    source: "scenes",
    window: "ciclo",
    method: "Conteo de fechas distintas",
    digits: 0,
    hint: "Referencia del dataset oficial: ≈ 54 fechas (≈ 34 S2 + ≈ 20 Landsat).",
  },
  {
    key: "bas_lai_espigado_llenado",
    label: "LAI en espigado-llenado",
    unit: "m²/m²",
    source: "s2",
    window: "espigado",
    method: "Mediana de promedios por escena",
    digits: 2,
  },
  {
    key: "bas_ndti_emergencia_macollamiento",
    label: "NDTI en emergencia-macollamiento",
    unit: "índice",
    source: "s2",
    window: "emergencia",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_sti_encanado",
    label: "STI en encañado",
    unit: "índice",
    source: "s2",
    window: "encanado",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_ndvi_emergencia_macollamiento",
    label: "NDVI en emergencia-macollamiento",
    unit: "índice",
    source: "s2",
    window: "emergencia",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_ndwi_espigado_llenado",
    label: "NDWI en espigado-llenado",
    unit: "índice",
    source: "s2",
    window: "espigado",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_ndti_encanado",
    label: "NDTI en encañado",
    unit: "índice",
    source: "s2",
    window: "encanado",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_evi_emergencia_macollamiento",
    label: "EVI en emergencia-macollamiento",
    unit: "índice",
    source: "s2",
    window: "emergencia",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
  {
    key: "bas_evi_encanado",
    label: "EVI en encañado",
    unit: "índice",
    source: "s2",
    window: "encanado",
    method: "Mediana de promedios por escena",
    digits: 3,
  },
];

/** Año con el que se entrenó el modelo (ciclo abril–octubre). */
export const TRAINED_YEAR = 2025;
export const YEARS = [2025, 2024, 2023];

/** Estados con los que se entrenó y valida el modelo. */
export const ESTADOS = ["Hidalgo", "Puebla", "Tlaxcala"];

/** Tolerancias del Paso 8 de la guía: índices y lluvia ±15 %; el conteo de escenas puede diferir más. */
export const VALIDATION_TOLERANCE = { default: 15, bas_n_obs_ciclo: 30 };

/** Preguntas del botón de información de la pantalla. */
export const SAT_QUESTIONS = [
  {
    question: "¿Qué hace esta pantalla?",
    answer:
      "Dibujas el contorno de una parcela nueva sobre el mapa satelital y el servidor lee imágenes satelitales reales para calcular las 10 variables que usa el modelo. Con ellas el Random Forest estima el rendimiento, el intervalo de confianza y el semáforo de elegibilidad, igual que con las parcelas del dataset.",
  },
  {
    question: "¿De dónde salen los datos y cuánto cuestan?",
    answer:
      "De Sentinel-2 (NDVI, EVI, LAI, NDWI, NDTI y STI), Landsat 8/9 (solo para contar escenas) y CHIRPS (lluvia). Son fuentes abiertas que se leen sin cuenta, sin tarjeta y sin cuota de uso. El modelo final no usa Planet ni ningún índice de pago.",
  },
  {
    question: "¿Por qué tarda?",
    answer:
      "Para cada una de las ~25 escenas de la temporada se descarga solo el recorte de tu parcela, y la lluvia se suma día por día durante 61 días. Una parcela tarda entre 30 y 90 s. La primera consulta del día puede tardar más si el servidor estaba dormido.",
  },
  {
    question: "¿Cómo se calcula cada valor?",
    answer:
      "Por cada escena se promedia el índice dentro del polígono y, entre las escenas de cada ventana fenológica, se toma la mediana. Es el mismo procedimiento del dataset oficial; un compuesto por píxel daría números distintos.",
  },
  {
    question: "¿Los números son idénticos a los del dataset oficial?",
    answer:
      "No necesariamente. Pueden diferir un poco por la versión del procesamiento de las imágenes y por cómo se ponderan los píxeles de borde. Por eso existe la pestaña «Validación del cálculo», que compara contra el dataset oficial parcela por parcela.",
  },
  {
    question: "¿Qué pasa si elijo otro año?",
    answer:
      "El modelo se entrenó con el ciclo abril–octubre de 2025. Para otros años el clima es distinto y el modelo extrapola, por eso el resultado debe leerse con cautela.",
  },
  {
    question: "¿Y si la parcela queda fuera de Hidalgo, Puebla o Tlaxcala?",
    answer:
      "Puede calcularse, pero el modelo solo vio parcelas de esos tres estados y validó por regiones: fuera de ahí la predicción no está respaldada.",
  },
];
