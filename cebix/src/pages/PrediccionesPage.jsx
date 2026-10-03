import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Gauge,
  Percent,
  Droplets,
  Leaf,
  Send,
  CheckCircle2,
  Sprout,
  Sun,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import StatCard from "../components/ui/StatCard";
import Semaphore from "../components/ui/Semaphore";
import InfoButton from "../components/ui/InfoButton";
import ConfidenceRange from "../components/charts/ConfidenceRange";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import StaticMapImage from "../components/map/StaticMapImage";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useModelInfo } from "../context/ModelInfoContext";
import { generateCreditReportPDF } from "../utils/creditReport";
import RequireAnalysis from "../components/ui/RequireAnalysis";

const chartQuestions = [
  {
    question: "¿Qué muestra la gráfica de rendimiento esperado a cosecha?",
    answer:
      "Ubica el rendimiento estimado (en ton/ha) sobre una escala fija de 0 al máximo observado. La franja sombreada alrededor del punto es el intervalo de confianza al 90%: entre más angosta, más segura es la predicción del modelo para esa parcela.",
  },
  {
    question: "¿Cómo se interpreta la gráfica de variables que más influyeron?",
    answer:
      "Es la contribución SHAP de cada variable satelital y climática sobre la predicción de esa parcela. Las barras en color de acento suman al rendimiento estimado; las barras en rojo restan. Entre más larga la barra, mayor fue el peso de esa variable en el resultado.",
  },
  {
    question: "¿Por qué dos parcelas con el mismo NDVI pueden tener predicciones distintas?",
    answer:
      "El modelo combina varias variables satelitales y climáticas a la vez, no solo el NDVI. La gráfica de variables que más influyeron muestra exactamente cuáles pesaron más en cada caso particular.",
  },
];

/** Encabezado de sección: título + descripción opcional, con aire fijo debajo. */
function SectionHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}

/**
 * Contenedor de celdas pegadas: un solo borde exterior y las celdas
 * compartiendo línea, sin fondo. El -mr-px/-mb-px del interior esconde el
 * borde sobrante de la última columna/fila aunque el grid se reacomode.
 */
function JoinedCells({ className = "", children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <div className={`-mb-px -mr-px grid ${className}`}>{children}</div>
    </div>
  );
}

const CELL = "relative overflow-hidden border-b border-r border-gray-200 p-5 dark:border-gray-800";

/** Fila etiqueta/valor de las fichas. */
function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

function PrediccionesPageContent() {
  const { parcels, submissions, submitToCommittee } = useParcels();
  const { info } = useModelInfo();
  const [selectedId, setSelectedId] = useState(parcels[0].id);
  const parcel = parcels.find((p) => p.id === selectedId) ?? parcels[0];
  const submittedAt = submissions[parcel.id];
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleSubmit = () => {
    submitToCommittee(parcel.id);
    generateCreditReportPDF(parcel, { submitted: true, modelSummary: info?.modelSummary });
    toast.success("Solicitud enviada al comité y reporte PDF generado.");
    setJustSubmitted(true);
    window.setTimeout(() => setJustSubmitted(false), 2500);
  };

  const buttonLabel = useMemo(() => {
    if (justSubmitted) return "Enviado ✓";
    if (submittedAt) return "Reenviar a comité de crédito";
    return "Enviar a comité de crédito";
  }, [justSubmitted, submittedAt]);

  // Promedios de la región de la parcela seleccionada, para dar contexto a
  // las variables que aún no aparecen en las tarjetas superiores (EVI y GDD).
  const regionAverages = useMemo(() => {
    const regionParcels = parcels.filter((p) => p.region === parcel.region);
    const avg = (key) => regionParcels.reduce((sum, p) => sum + p[key], 0) / regionParcels.length;
    return {
      count: regionParcels.length,
      evi: avg("evi"),
      gdd: avg("gdd"),
    };
  }, [parcels, parcel.region]);

  const climateVariables = useMemo(() => {
    const deltaMeta = (value, avg) => {
      if (!avg) return { deltaIcon: Minus, deltaLabel: "Sin referencia regional" };
      const diff = ((value - avg) / avg) * 100;
      if (Math.abs(diff) < 0.5) {
        return { deltaIcon: Minus, deltaLabel: "En línea con el promedio regional" };
      }
      return {
        deltaIcon: diff > 0 ? TrendingUp : TrendingDown,
        deltaLabel: `${diff > 0 ? "+" : ""}${diff.toFixed(0)}% vs. promedio de ${parcel.region}`,
      };
    };

    return [
      {
        label: "EVI",
        value: parcel.evi.toFixed(2),
        icon: Sprout,
        ...deltaMeta(parcel.evi, regionAverages.evi),
      },
      {
        label: "GDD acumulados",
        value: `${parcel.gdd}`,
        icon: Sun,
        ...deltaMeta(parcel.gdd, regionAverages.gdd),
      },
    ];
  }, [parcel, regionAverages]);

  const originLabel = parcel.isCustom
    ? "Registrada manualmente en CEBIX"
    : parcel.isTrainingSet
      ? "Entrenamiento — rendimiento real observado"
      : "Predicción — validación espacial leave-region-out";

  return (
    <>
      <TopBar
        title="Predicciones"
        subtitle="Rendimiento esperado y el motivo detrás, parcela por parcela."
        hideSearch
        actions={
          <InfoButton title="Acerca de las gráficas" questions={chartQuestions} />
        }
      />

      <div className="mt-6" aria-hidden="true" />

      <div className="grid grid-cols-1 items-start gap-12 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr] lg:gap-14 lg:px-8">
        {/* Columna izquierda: selector, semáforo y datos/acción */}
        <aside className="min-w-0 space-y-10">
          <section>
            <SectionHeader
              title="Parcela seleccionada"
              description="Cambia de parcela para actualizar la predicción."
            />
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="w-full appearance-none rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-black py-2.5 pl-4 pr-10 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-xs focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500"
              >
                {parcels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.municipio}, {p.region}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
            </div>
          </section>

          <section>
            <SectionHeader title="Elegibilidad" />
            <Semaphore score={parcel.score} />
          </section>

          <section>
            <SectionHeader title="Datos de la parcela" />
            <dl>
              <DetailRow label="Municipio">{parcel.municipio}</DetailRow>
              <DetailRow label="Superficie">{parcel.area}</DetailRow>
              {submittedAt && (
                <DetailRow label="Última solicitud">
                  <span className="text-ndvi-600 dark:text-ndvi-400">
                    {new Date(submittedAt).toLocaleDateString("es-MX")}
                  </span>
                </DetailRow>
              )}
            </dl>

            <button
              type="button"
              onClick={handleSubmit}
              className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xs transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
                justSubmitted
                  ? "bg-ndvi-600 text-white"
                  : "bg-accent-500 text-accent-contrast hover:bg-accent-600"
              }`}
            >
              {justSubmitted ? <CheckCircle2 size={15} /> : <Send size={15} />}
              {buttonLabel}
            </button>
            {submittedAt && !justSubmitted && (
              <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
                Enviada el {new Date(submittedAt).toLocaleString("es-MX")}
              </p>
            )}
          </section>
        </aside>

        {/* Contenido principal: métricas, gráficas y mapa */}
        <AnimatePresence mode="wait">
          <motion.div
            key={parcel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="min-w-0 space-y-14"
          >
            {/* Métricas clave */}
            <JoinedCells className="grid-cols-2 lg:grid-cols-4">
              <div className={CELL}>
                <StatCard
                  label="Rendimiento esperado"
                  value={`${parcel.yieldEstimate.toFixed(1)} ton/ha`}
                  hint={`± ${parcel.confidence.toFixed(1)} ton/ha`}
                  icon={Gauge}
                  tone="navy"
                  cornerIcon
                />
              </div>
              <div className={CELL}>
                <StatCard
                  label="Score de elegibilidad"
                  value={`${parcel.score} / 100`}
                  hint="Semáforo de riesgo"
                  icon={Percent}
                  tone="navy"
                  cornerIcon
                />
              </div>
              <div className={CELL}>
                <StatCard
                  label="NDVI pico"
                  value={parcel.ndvi.toFixed(2)}
                  hint="Máximo del ciclo"
                  icon={Leaf}
                  tone="navy"
                  cornerIcon
                />
              </div>
              <div className={CELL}>
                <StatCard
                  label="Precipitación"
                  value={`${parcel.precip} mm`}
                  hint="Acumulada en el ciclo"
                  icon={Droplets}
                  tone="navy"
                  cornerIcon
                />
              </div>
            </JoinedCells>

            {/* Rendimiento a cosecha + ubicación */}
            <section className="grid grid-cols-1 gap-10 sm:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <SectionHeader
                  title="Rendimiento esperado a cosecha"
                  description="Estimación del modelo con su intervalo de confianza sobre la escala de rendimiento."
                />
                <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
              </div>

              <div className="min-w-0">
                <SectionHeader title="Ubicación" description={`${parcel.municipio}, ${parcel.region}`} />
                {hasCoords(parcel) ? (
                  <StaticMapImage lat={parcel.lat} lng={parcel.lng} zoom={15} height={200} rounded />
                ) : (
                  <div className="flex h-[200px] items-center justify-center rounded-2xl bg-gray-50 px-4 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    El CSV no incluye coordenadas (lat, lng): no se puede mostrar la ubicación.
                  </div>
                )}
              </div>
            </section>

            {/* Variables SHAP + ficha técnica */}
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_280px]">
              <section className="min-w-0">
                <SectionHeader
                  title="Variables que más influyeron"
                  description={`Contribución SHAP de cada variable a la predicción de ${parcel.name}.`}
                />
                <FeatureImportanceChart data={parcel.shap} />
              </section>

              <section>
                <SectionHeader title="Ficha técnica" />
                <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                  <dl>
                    <DetailRow label="ID de polígono">{parcel.polygonId}</DetailRow>
                    <DetailRow label="Región">
                      {parcel.region} ({parcel.regionCode})
                    </DetailRow>
                    <DetailRow label="Coordenadas">
                      {hasCoords(parcel) ? `${parcel.lat.toFixed(4)}, ${parcel.lng.toFixed(4)}` : "—"}
                    </DetailRow>
                  </dl>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Origen del dato</p>
                    <p className="mt-1 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{originLabel}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Otras variables vs. promedio regional */}
            <section>
              <SectionHeader
                title="Otras variables vs. promedio regional"
                description={`EVI y grados-día de ${parcel.name}, comparados contra el promedio de las ${regionAverages.count} parcelas de ${parcel.region}.`}
              />
              <JoinedCells className="grid-cols-1 sm:grid-cols-2">
                {climateVariables.map((v) => (
                  <div key={v.label} className={CELL}>
                    <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400">{v.label}</p>
                    <p className="font-display relative z-10 mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {v.value}
                    </p>
                    <p className="relative z-10 mt-1 flex items-center gap-1.5 pr-12 text-xs text-gray-500 dark:text-gray-400">
                      <v.deltaIcon size={12} />
                      {v.deltaLabel}
                    </p>
                    <v.icon
                      aria-hidden="true"
                      size={64}
                      strokeWidth={1.75}
                      className="pointer-events-none absolute -bottom-5 -right-2 -rotate-12 text-accent-600 dark:text-accent-400"
                    />
                  </div>
                ))}
              </JoinedCells>
            </section>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

export default function PrediccionesPage() {
  return (
    <RequireAnalysis title="Predicciones" subtitle="Rendimiento estimado por el modelo." >
      <PrediccionesPageContent />
    </RequireAnalysis>
  );
}
