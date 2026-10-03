import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseCSV } from "../utils/csv";
import { globalImportance } from "../data/shap";
import { appStorage } from "../services/AppStorage";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabaseClient";

const SUBMISSIONS_KEY = "cebix-committee-submissions";
const ANALYSIS_KEY = "cebix-analysis-v1";
const REGION_COLOR = { Puebla: "#4C9A63", Hidalgo: "#374151", Tlaxcala: "#C08A2E" };

const REGION_CODE = { Hidalgo: "HGO", Tlaxcala: "TLX", Puebla: "PUE" };

const loadSubmissions = () => appStorage.getJSON(SUBMISSIONS_KEY, {});
const persistSubmissions = (map) => appStorage.setJSON(SUBMISSIONS_KEY, map);

/** Deriva score / riesgo / semáforo a partir del rendimiento estimado y su margen de error,
 * usando el mismo criterio que ya usa el dataset (score >= 70 elegible, 45-69 revisión, <45 alto riesgo). */
export function scoreFromInputs({ yieldEstimate, confidence, ndvi, precip }) {
  // Heurística explícita y trazable (no es el Random Forest de producción, que
  // requiere features satelitales completas): combina rendimiento normalizado
  // sobre 6 ton/ha, vigor NDVI y estabilidad (menor margen de error = más
  // confianza), en las mismas proporciones que discute src/data/model.js.
  const yieldScore = Math.max(0, Math.min(1, yieldEstimate / 6)) * 55;
  const ndviScore = Math.max(0, Math.min(1, (ndvi - 0.3) / 0.5)) * 30;
  const stabilityPenalty = Math.max(0, Math.min(1, confidence / 1.5)) * 15;
  const raw = yieldScore + ndviScore - stabilityPenalty + 15;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function classifyRisk(score) {
  if (score >= 70) return { risk: "Elegible", riskColor: "green" };
  if (score >= 45) return { risk: "Revisión", riskColor: "yellow" };
  return { risk: "Alto riesgo", riskColor: "red" };
}

/** SHAP local aproximado para parcelas capturadas manualmente: usa la importancia
 * global real del modelo (src/data/shap.js) y la escala por qué tan lejos está
 * cada variable de la parcela del promedio del portafolio base.
 *
 * El modelo final (Random Forest, top-10 SHAP, sin Planet) ya no usa temperatura/GDD ni
 * NDVI pico. Del formulario manual solo tres campos corresponden a features reales:
 *   precip -> Precipitación en emergencia-macollamiento (precip es el acumulado del ciclo,
 *             se usa como aproximación de esa ventana)
 *   ndvi   -> NDVI en emergencia-macollamiento
 *   evi    -> EVI en emergencia-macollamiento
 * El signo del impacto respeta la dirección real de cada variable en shap.js. */
const SHAP_DRIVERS = [
  { field: "precip", feature: "Precipitación en emergencia-macollamiento" },
  { field: "ndvi", feature: "NDVI en emergencia-macollamiento" },
  { field: "evi", feature: "EVI en emergencia-macollamiento" },
];

const FALLBACK_IMPORTANCE = { precip: 0.65, ndvi: 0.02, evi: 0.02 };

function approximateShap(fields, existingParcels = []) {
  return SHAP_DRIVERS.map(({ field, feature }) => {
    const avg = average(existingParcels.map((p) => p[field]).filter(Number.isFinite));
    const entry = globalImportance.find((g) => g.feature === feature);
    const base = entry?.value ?? FALLBACK_IMPORTANCE[field];
    const sign = entry?.direction === "negativo" ? -1 : 1;
    const delta = avg ? (fields[field] - avg) / avg : 0;
    const impact = Number((delta * base * sign).toFixed(3));
    return {
      feature,
      impact,
      direction: impact >= 0 ? "positivo" : "negativo",
    };
  }).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function nextId(all) {
  return all.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

function fromDatabaseParcel(row) {
  return {
    id: row.id,
    polygonId: row.polygon_id,
    name: row.name,
    area: row.area,
    yieldEstimate: Number(row.yield_estimate),
    confidence: Number(row.confidence),
    score: Number(row.score),
    risk: row.risk,
    riskColor: row.risk_color,
    region: row.region,
    municipio: row.municipio,
    regionCode: row.region_code,
    lat: Number(row.lat),
    lng: Number(row.lng),
    ndvi: Number(row.ndvi),
    evi: Number(row.evi),
    precip: Number(row.precip),
    gdd: Number(row.gdd),
    isTrainingSet: false,
    isCustom: true,
    shap: row.shap ?? [],
  };
}

function toDatabaseParcel(record) {
  return {
    polygon_id: record.polygonId,
    name: record.name,
    area: record.area,
    yield_estimate: record.yieldEstimate,
    confidence: record.confidence,
    score: record.score,
    risk: record.risk,
    risk_color: record.riskColor,
    region: record.region,
    municipio: record.municipio,
    region_code: record.regionCode,
    lat: record.lat,
    lng: record.lng,
    ndvi: record.ndvi,
    evi: record.evi,
    precip: record.precip,
    gdd: record.gdd,
    shap: record.shap,
  };
}

/** Normaliza un registro (de formulario manual o de una fila de CSV) a un objeto parcela completo. */
export function buildParcelRecord(fields, existingParcels) {
  const yieldEstimate = Number(fields.yieldEstimate);
  const confidence = Number(fields.confidence ?? 0.7);
  const ndvi = Number(fields.ndvi);
  const evi = Number(fields.evi ?? ndvi * 0.22);
  const precip = Number(fields.precip);
  const gdd = Number(fields.gdd);
  const region = fields.region;
  const score =
    fields.score !== undefined && fields.score !== "" && !Number.isNaN(Number(fields.score))
      ? Math.round(Number(fields.score))
      : scoreFromInputs({ yieldEstimate, confidence, ndvi, precip });
  const { risk, riskColor } = classifyRisk(score);

  return {
    id: fields.id ?? nextId(existingParcels),
    polygonId: fields.polygonId || `AGC_C${String(nextId(existingParcels)).padStart(3, "0")}`,
    name: fields.name,
    area: fields.area,
    yieldEstimate,
    confidence,
    score,
    risk,
    riskColor,
    region,
    municipio: fields.municipio,
    regionCode: fields.regionCode || REGION_CODE[region] || region.slice(0, 3).toUpperCase(),
    lat: Number(fields.lat),
    lng: Number(fields.lng),
    ndvi,
    evi,
    precip,
    gdd,
    isTrainingSet: false,
    isCustom: true,
    shap: approximateShap({ ndvi, evi, precip }, existingParcels),
  };
}


const numOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const firstNum = (...vals) => {
  for (const v of vals) {
    const n = numOrNull(v);
    if (n !== null) return n;
  }
  return null;
};

/** Convierte una predicción REAL del backend (+ las columnas del CSV subido, si hay)
 * en el objeto parcela que usan todas las pantallas. No hay valores precargados:
 * todo viene de lo que el modelo calculó en esa corrida. */
export function buildAnalysisParcel(pred, row = {}, index = 0) {
  const meta = { ...row, ...pred }; // el backend devuelve Municipio/lat/lng/area_ha si venían en el CSV
  const polygonId = String(pred.ID_POLIGONO);
  const region = pred.Estado || row.Estado || "Puebla";
  const yieldEstimate = Number(pred.yieldEstimate);
  const confidence = Number(pred.confidence);

  // Mismos campos que se mostraban antes, ahora leídos del CSV de la corrida.
  const ndvi = firstNum(row.bas_ndvi_pico_ciclo, row.ndvi, row.bas_ndvi_emergencia_macollamiento) ?? 0;
  const evi = firstNum(row.bas_evi_encanado, row.evi, row.bas_evi_emergencia_macollamiento) ?? 0;
  const precip = firstNum(row.precip_acum_ciclo_mm, row.precip, row.precip_acum_emergencia_macollamiento_mm) ?? 0;
  const gdd = firstNum(row.gdd_acumulado_ciclo, row.gdd) ?? 0;
  const area = firstNum(meta.area_ha, meta.AREA_HA);

  const score = scoreFromInputs({ yieldEstimate, confidence, ndvi, precip });
  const { risk, riskColor } = classifyRisk(score);
  const tail = /^AGC_(\d+)$/i.exec(polygonId);

  return {
    id: tail ? Number(tail[1]) : 100000 + index,
    polygonId,
    name: `Parcela ${polygonId}`,
    area: area !== null ? `${area.toFixed(2)} ha` : "— ha",
    yieldEstimate,
    confidence,
    ic90: [Number(pred.ic90_inferior), Number(pred.ic90_superior)],
    score,
    risk,
    riskColor,
    region,
    municipio: meta.Municipio || meta.municipio || "—",
    regionCode: REGION_CODE[region] || String(region).slice(0, 3).toUpperCase(),
    lat: firstNum(meta.lat, meta.latitud),
    lng: firstNum(meta.lng, meta.lon, meta.longitud),
    ndvi,
    evi,
    precip,
    gdd,
    isTrainingSet: false,
    isCustom: false,
    fromModelRun: true,
    shap: pred.shap ?? [],
  };
}

export function hasCoords(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
}

const ParcelsContext = createContext(null);

export function ParcelsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [customParcels, setCustomParcels] = useState([]);
  // Resultado de la última corrida REAL del modelo. Arranca vacío: el dashboard no trae datos precargados.
  const [analysis, setAnalysis] = useState(() => appStorage.getJSON(ANALYSIS_KEY, null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState(loadSubmissions);

  const loadCustomParcels = useCallback(async () => {
    if (!user) {
      setCustomParcels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase.from("parcels_custom").select("*");
    if (queryError) {
      setError(queryError);
      setCustomParcels([]);
    } else {
      setError(null);
      setCustomParcels(data.map(fromDatabaseParcel));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadCustomParcels();
  }, [authLoading, loadCustomParcels]);

  const analysisParcels = useMemo(() => analysis?.parcels ?? [], [analysis]);
  const parcels = useMemo(() => [...analysisParcels, ...customParcels], [analysisParcels, customParcels]);

  /** Guarda la salida del modelo (respuesta de /predict-csv) y el CSV de origen. */
  const loadAnalysis = useCallback((predicciones, csvText = "", fileName = "") => {
    const rows = csvText ? parseCSV(csvText) : [];
    const byId = new Map(rows.map((r) => [String(r.ID_POLIGONO), r]));
    const built = predicciones.map((pred, i) => buildAnalysisParcel(pred, byId.get(String(pred.ID_POLIGONO)), i));
    const next = { parcels: built, fileName, runAt: new Date().toISOString() };
    setAnalysis(next);
    appStorage.setJSON(ANALYSIS_KEY, next);
    return built;
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    appStorage.setJSON(ANALYSIS_KEY, null);
  }, []);

  const regionSummary = useMemo(() => {
    const counts = new Map();
    for (const p of parcels) {
      const entry = counts.get(p.region) ?? {
        region: p.region,
        code: p.regionCode,
        parcelCount: 0,
        color: REGION_COLOR[p.region] ?? "#98A2B3",
      };
      entry.parcelCount += 1;
      counts.set(p.region, entry);
    }
    return Array.from(counts.values()).sort((a, b) => b.parcelCount - a.parcelCount);
  }, [parcels]);

  const addParcel = useCallback(async (fields) => {
    const record = buildParcelRecord(fields, [...analysisParcels, ...customParcels]);
    const { data, error: insertError } = await supabase
      .from("parcels_custom")
      .insert(toDatabaseParcel(record))
      .select()
      .single();
    if (insertError) return { error: insertError };

    const savedParcel = fromDatabaseParcel(data);
    setCustomParcels((prev) => [...prev, savedParcel]);
    return { data: savedParcel, error: null };
  }, [analysisParcels, customParcels]);

  const updateParcel = useCallback(async (id, fields) => {
    const isCustom = customParcels.some((p) => p.id === id);
    if (!isCustom) return { error: new Error("Las parcelas del dataset son de solo lectura") };

    const record = buildParcelRecord(
      { ...fields, id },
      [...analysisParcels, ...customParcels.filter((parcel) => parcel.id !== id)]
    );
    const { data, error: updateError } = await supabase
      .from("parcels_custom")
      .update(toDatabaseParcel(record))
      .eq("id", id)
      .select()
      .single();
    if (updateError) return { error: updateError };

    const savedParcel = fromDatabaseParcel(data);
    setCustomParcels((prev) => prev.map((parcel) => (parcel.id === id ? savedParcel : parcel)));
    return { data: savedParcel, error: null };
  }, [analysisParcels, customParcels]);

  const removeParcel = useCallback(async (id) => {
    const isCustom = customParcels.some((p) => p.id === id);
    if (!isCustom) return { error: new Error("Las parcelas del dataset son de solo lectura") };

    const { error: deleteError } = await supabase.from("parcels_custom").delete().eq("id", id);
    if (deleteError) return { error: deleteError };

    setCustomParcels((prev) => prev.filter((parcel) => parcel.id !== id));
    return { error: null };
  }, [customParcels]);

  const submitToCommittee = useCallback((id) => {
    setSubmissions((prev) => {
      const next = { ...prev, [id]: new Date().toISOString() };
      persistSubmissions(next);
      return next;
    });
  }, []);

  const isCustomParcel = useCallback((id) => customParcels.some((p) => p.id === id), [customParcels]);

  const value = useMemo(
    () => ({
      parcels,
      regionSummary,
      hasAnalysis: analysisParcels.length > 0,
      analysisMeta: analysis ? { fileName: analysis.fileName, runAt: analysis.runAt, count: analysisParcels.length } : null,
      loadAnalysis,
      clearAnalysis,
      addParcel,
      updateParcel,
      removeParcel,
      isCustomParcel,
      customParcelsLoading: loading,
      customParcelsError: error,
      reloadCustomParcels: loadCustomParcels,
      submissions,
      submitToCommittee,
    }),
    [
      parcels,
      regionSummary,
      analysisParcels,
      analysis,
      loadAnalysis,
      clearAnalysis,
      addParcel,
      updateParcel,
      removeParcel,
      isCustomParcel,
      loading,
      error,
      loadCustomParcels,
      submissions,
      submitToCommittee,
    ]
  );

  return <ParcelsContext.Provider value={value}>{children}</ParcelsContext.Provider>;
}

export function useParcels() {
  const ctx = useContext(ParcelsContext);
  if (!ctx) throw new Error("useParcels debe usarse dentro de <ParcelsProvider>");
  return ctx;
}
