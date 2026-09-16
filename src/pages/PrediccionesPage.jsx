import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Gauge, Percent, Droplets, Leaf, Send, CheckCircle2 } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import StatCard from "../components/ui/StatCard";
import Semaphore from "../components/ui/Semaphore";
import ConfidenceRange from "../components/charts/ConfidenceRange";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import ParcelMap from "../components/map/ParcelMap";
import { useParcels } from "../context/ParcelsContext";
import { generateCreditReportPDF } from "../utils/creditReport";

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

  return (
    <>
      <TopBar
        title="Predicciones"
        subtitle="Rendimiento esperado y el motivo detrás, parcela por parcela."
        hideSearch
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 px-8 py-6 lg:grid-cols-[280px_1px_1fr] lg:gap-8">
        {/* Rail izquierdo: selector + semáforo + resumen + acción */}
        <aside className="bg-white dark:bg-black">
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
            className="mt-6 flex w-full items-center justify-center gap-2 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-70"
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
        >
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 border border-gray-200 dark:divide-gray-800 dark:border-gray-800 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4">
              <StatCard
                label="Rendimiento esperado"
                value={`${parcel.yieldEstimate.toFixed(1)} ton/ha`}
                hint={`± ${parcel.confidence.toFixed(1)} ton/ha`}
                icon={Gauge}
                tone="brand"
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
                tone="ndvi"
              />
            </div>
            <div className="p-4">
              <StatCard
                label="Precipitación"
                value={`${parcel.precip} mm`}
                hint="Acumulada en el ciclo"
                icon={Droplets}
                tone="brand"
              />
            </div>
          </div>

          <div className="my-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Rendimiento esperado a cosecha
            </h2>
            <div className="mt-4">
              <ConfidenceRange estimate={parcel.yieldEstimate} confidence={parcel.confidence} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-200 pt-6 dark:border-gray-800 lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Variables que más influyeron
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Contribución SHAP; verde suma al rendimiento, rojo resta.
              </p>
              <div className="mt-4">
                <FeatureImportanceChart data={parcel.shap} height={200} />
              </div>
            </div>

            <ParcelMap
              parcels={[parcel]}
              height={320}
              center={[parcel.lat, parcel.lng]}
              zoom={17}
              showLayerControl={false}
              showBoundariesByDefault={false}
            />
          </div>
        </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
