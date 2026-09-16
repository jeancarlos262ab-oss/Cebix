import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parcels as baseParcels, regionSummary as baseRegionSummary } from "../data/parcels";
import { globalImportance } from "../data/shap";

const STORAGE_KEY = "cebix-custom-parcels";
const SUBMISSIONS_KEY = "cebix-committee-submissions";

const REGION_CODE = { Hidalgo: "HGO", Tlaxcala: "TLX", Puebla: "PUE" };

function loadCustomParcels() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistCustomParcels(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage no disponible (modo privado, etc.) — no bloquea la app.
  }
}

function loadSubmissions() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSubmissions(map) {
  try {
    window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Deriva score / riesgo / semáforo a partir del rendimiento estimado y su margen de error,
 * usando el mismo criterio que ya usa el dataset (score >= 70 elegible, 45-69 revisión, <45 alto riesgo). */
export function scoreFromInputs({ yieldEstimate, confidence, ndvi, precip }) {
  // Heurística explícita y trazable (no es el modelo Ridge de producción, que
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
 * cada variable de la parcela del promedio del portafolio base. */
function approximateShap(fields) {
  const avg = {
    ndvi: average(baseParcels.map((p) => p.ndvi)),
    precip: average(baseParcels.map((p) => p.precip)),
    gdd: average(baseParcels.map((p) => p.gdd)),
  };
  const drivers = [
    {
      feature: "NDVI pico del ciclo",
      delta: (fields.ndvi - avg.ndvi) / avg.ndvi,
      base: globalImportance.find((g) => g.feature.includes("NDVI pico"))?.value ?? 0.05,
    },
    {
      feature: "Precipitación acumulada (ciclo)",
      delta: (fields.precip - avg.precip) / avg.precip,
      base: globalImportance.find((g) => g.feature.startsWith("Precipitación"))?.value ?? 0.15,
    },
    {
      feature: "Grados-día de crecimiento (GDD)",
      delta: (fields.gdd - avg.gdd) / avg.gdd,
      base: globalImportance.find((g) => g.feature.startsWith("Grados"))?.value ?? 0.16,
    },
  ];
  return drivers
    .map((d) => {
      const impact = Number((d.delta * d.base).toFixed(3));
      return {
        feature: d.feature,
        impact,
        direction: impact >= 0 ? "positivo" : "negativo",
      };
    })
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function nextId(all) {
  return all.reduce((max, p) => Math.max(max, p.id), 0) + 1;
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
    shap: approximateShap({ ndvi, precip, gdd }),
  };
}

const ParcelsContext = createContext(null);

export function ParcelsProvider({ children }) {
  const [customParcels, setCustomParcels] = useState(loadCustomParcels);
  const [submissions, setSubmissions] = useState(loadSubmissions);

  const parcels = useMemo(() => [...baseParcels, ...customParcels], [customParcels]);

  const regionSummary = useMemo(() => {
    const counts = new Map(baseRegionSummary.map((r) => [r.region, { ...r }]));
    for (const p of customParcels) {
      const entry = counts.get(p.region) ?? { region: p.region, parcelCount: 0, color: "#98A2B3" };
      entry.parcelCount += 1;
      counts.set(p.region, entry);
    }
    return Array.from(counts.values());
  }, [customParcels]);

  const addParcel = useCallback((fields) => {
    setCustomParcels((prev) => {
      const record = buildParcelRecord(fields, [...baseParcels, ...prev]);
      const next = [...prev, record];
      persistCustomParcels(next);
      return next;
    });
  }, []);

  const updateParcel = useCallback((id, fields) => {
    const isCustom = customParcels.some((p) => p.id === id);
    if (!isCustom) return; // Las 197 parcelas del reto son de solo lectura (dataset validado).
    setCustomParcels((prev) => {
      const next = prev.map((p) =>
        p.id === id ? buildParcelRecord({ ...fields, id }, [...baseParcels, ...prev.filter((x) => x.id !== id)]) : p
      );
      persistCustomParcels(next);
      return next;
    });
  }, [customParcels]);

  const removeParcel = useCallback((id) => {
    setCustomParcels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistCustomParcels(next);
      return next;
    });
  }, []);

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
      addParcel,
      updateParcel,
      removeParcel,
      isCustomParcel,
      submissions,
      submitToCommittee,
    }),
    [parcels, regionSummary, addParcel, updateParcel, removeParcel, isCustomParcel, submissions, submitToCommittee]
  );

  return <ParcelsContext.Provider value={value}>{children}</ParcelsContext.Provider>;
}

export function useParcels() {
  const ctx = useContext(ParcelsContext);
  if (!ctx) throw new Error("useParcels debe usarse dentro de <ParcelsProvider>");
  return ctx;
}
