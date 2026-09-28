import { useMemo, useState } from "react";
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
import { useParcels } from "../context/ParcelsContext";
import { generateCreditReportPDF } from "../utils/creditReport";

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
      "El modelo combina varias variables a la vez (temperatura, precipitación, grados-día, NDWI, EVI, etc.), no solo el NDVI. La gráfica de variables que más influyeron muestra exactamente cuáles pesaron más en cada caso particular.",
  },
];

export default function PrediccionesPage() {
  const { parcels, submissions, submitToCommittee } = useParcels();
  const [selectedId, setSelectedId] = useState(parcels[0].id);
  const parcel = parcels.find((p) => p.id === selectedId) ?? parcels[0];
  const submittedAt = submissions[parcel.id];
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleSubmit = () => {
    submitToCommittee(parcel.id);
    generateCreditReportPDF(parcel, { submitted: true });
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
          <InfoButton title="Acerca de las gráficas" questions={chartQuestions} tone="accent" />
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1px_1fr]">
        {/* Rail izquierdo: selector + semáforo + resumen + acción */}
        <aside className="bg-white px-4 py-6 dark:bg-black sm:px-6 lg:pl-8 lg:pr-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Parcela seleccionada
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Cambia de parcela para actualizar la predicción.
          </p>

          <div className="relative mt-4 mb-6 inline-block w-full">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full appearance-none border border-gray-200 dark:border-gray-800 bg-white dark:bg-black py-2.5 pl-3 pr-9 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
            >
              {parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.municipio}, {p.region}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
          </div>

          <div className="mt-5">
            <Semaphore score={parcel.score} />
          </div>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Parcela</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.name}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Municipio</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.municipio}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Superficie</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.area}</dd>
            </div>
            {submittedAt && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Última solicitud</dt>
                <dd className="font-medium text-ndvi-600 dark:text-ndvi-400">
                  {new Date(submittedAt).toLocaleDateString("es-MX")}
                </dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            onClick={handleSubmit}
            className="mt-6 flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-600 disabled:opacity-70"
          >
            {justSubmitted ? <CheckCircle2 size={15} /> : <Send size={15} />}
            {buttonLabel}
          </button>
          {submittedAt && !justSubmitted && (
            <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              Enviada el {new Date(submittedAt).toLocaleString("es-MX")}
            </p>
          )}
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: métricas + gráficas + mapa */}
        <AnimatePresence mode="wait">
        <motion.div
          key={parcel.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className="min-w-0"
        >
          <div className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8">
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 border border-gray-200 dark:divide-gray-800 dark:border-gray-800 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4">
              <StatCard
                label="Rendimiento esperado"
                value={`${parcel.yieldEstimate.toFixed(1)} ton/ha`}
                hint={`± ${parcel.confidence.toFixed(1)} ton/ha`}
                icon={Gauge}
                tone="navy"
              />
            </div>
            <div className="p-4">
              <StatCard
                label="Score de elegibilidad"
                value={`${parcel.score} / 100`}
                hint="Semáforo de riesgo"
                icon={Percent}
                tone="navy"
              />
            </div>
            <div className="p-4">
              <StatCard
                label="NDVI pico"
                value={parcel.ndvi.toFixed(2)}
                hint="Máximo del ciclo"
                icon={Leaf}
                tone="navy"
              />
            </div>
            <div className="p-4">
              <StatCard
                label="Precipitación"
                value={`${parcel.precip} mm`}
                hint="Acumulada en el ciclo"
                icon={Droplets}
                tone="navy"
              />
            </div>
          </div>

          <div className="my-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_280px]">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Rendimiento esperado a cosecha
              </h2>
              <div className="mt-4">
                <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Ubicación
              </h2>
              <div className="mt-4">
                <StaticMapImage lat={parcel.lat} lng={parcel.lng} zoom={15} height={120} bordered />
              </div>
            </div>
          </div>

          <div className="my-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Variables que más influyeron
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Contribución SHAP de cada variable a la predicción de {parcel.name}.
              </p>
              <div className="mt-4">
                <FeatureImportanceChart data={parcel.shap} height={220} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Ficha técnica
              </h2>
              <div className="mt-4 border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">ID de polígono</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{parcel.polygonId}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Región</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                      {parcel.region} ({parcel.regionCode})
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">Coordenadas</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                      {parcel.lat.toFixed(4)}, {parcel.lng.toFixed(4)}
                    </dd>
                  </div>
                  <div className="border-t border-gray-100 pt-2.5 dark:border-gray-800">
                    <dt className="text-gray-500 dark:text-gray-400">Origen del dato</dt>
                    <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{originLabel}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="my-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Otras variables vs. promedio regional
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              EVI y grados-día de {parcel.name}, comparados contra el promedio de las {regionAverages.count}{" "}
              parcelas de {parcel.region}.
            </p>
            <div className="mt-4 grid grid-cols-2 divide-x divide-gray-200 border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {climateVariables.map((v) => (
                <div key={v.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{v.label}</p>
                    <span className="flex h-7 w-7 items-center justify-center bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      <v.icon size={14} />
                    </span>
                  </div>
                  <p className="font-sora mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {v.value}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <v.deltaIcon size={12} />
                    {v.deltaLabel}
                  </p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
