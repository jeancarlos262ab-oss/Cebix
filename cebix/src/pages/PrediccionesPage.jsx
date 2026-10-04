import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Send, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import Semaphore from "../components/ui/Semaphore";
import StaticMapImage from "../components/map/StaticMapImage";
import { Contributions, Label, Row, SummaryPanel } from "../components/results/ReportParts";
import { hasCoords, useParcels } from "../context/ParcelsContext";
import { useModelInfo } from "../context/ModelInfoContext";
import { generateCreditReportPDF } from "../utils/creditReport";
import RequireAnalysis from "../components/ui/RequireAnalysis";

const chartQuestions = [
  {
    question: "¿Qué muestra la gráfica de rendimiento esperado a cosecha?",
    answer:
      "Ubica el rendimiento estimado (en ton/ha) sobre una escala fija de 0 a 6. La marca es la estimación y el tramo sombreado es el intervalo de confianza al 90%: entre más angosto, más segura es la predicción del modelo para esa parcela.",
  },
  {
    question: "¿Cómo se interpreta la contribución de las variables?",
    answer:
      "Es la contribución SHAP de cada variable satelital y climática sobre la predicción de esa parcela. Las barras salen de un eje central: las que van a la derecha suman al rendimiento estimado y las que van a la izquierda restan. Entre más larga la barra, mayor fue el peso de esa variable en el resultado.",
  },
  {
    question: "¿Por qué dos parcelas con el mismo NDVI pueden tener predicciones distintas?",
    answer:
      "El modelo combina varias variables satelitales y climáticas a la vez, no solo el NDVI. La contribución de las variables muestra exactamente cuáles pesaron más en cada caso particular.",
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
    const fmtInt = (v) => Number(v).toLocaleString("es-MX", { maximumFractionDigits: 0 });
    const row = (label, value, avg, fmt) => {
      const base = { label, value: fmt(value), avg: avg ? fmt(avg) : "—" };
      if (!avg) return { ...base, icon: Minus, diff: "Sin referencia" };
      const d = ((value - avg) / avg) * 100;
      if (Math.abs(d) < 0.5) return { ...base, icon: Minus, diff: "En línea" };
      return { ...base, icon: d > 0 ? TrendingUp : TrendingDown, diff: `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(0)} %` };
    };
    return [
      row("EVI", parcel.evi, regionAverages.evi, (v) => Number(v).toFixed(2)),
      row("GDD acumulados", parcel.gdd, regionAverages.gdd, fmtInt),
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
            <Semaphore score={parcel.score} sober />
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
            className="min-w-0 space-y-10"
          >
            {/* Encabezado */}
            <header className="border-b border-gray-200 pb-4 dark:border-gray-800">
              <Label>Predicción</Label>
              <h2 className="mt-1 truncate font-display text-lg font-semibold text-gray-900 dark:text-gray-100">{parcel.name}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {parcel.municipio}, {parcel.region} · {parcel.area}
              </p>
            </header>

            {/* Resumen */}
            <SummaryPanel
              yieldEstimate={parcel.yieldEstimate}
              half={parcel.confidence}
              low={Math.max(0, parcel.yieldEstimate - parcel.confidence)}
              high={parcel.yieldEstimate + parcel.confidence}
              score={parcel.score}
              rows={[
                { label: "NDVI pico", value: parcel.ndvi.toFixed(2) },
                { label: "Precipitación del ciclo", value: `${parcel.precip} mm` },
              ]}
            />

            {/* Contribución de cada variable */}
            <section>
              <Label>Contribución de las variables</Label>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Valores SHAP de {parcel.name}, ordenados por magnitud: cuánto suma o resta cada variable a la estimación.
              </p>
              <Contributions data={parcel.shap} />
            </section>

            {/* Ubicación + ficha técnica */}
            <section className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="min-w-0">
                <Label>Ubicación</Label>
                <div className="mt-3">
                  {hasCoords(parcel) ? (
                    <StaticMapImage lat={parcel.lat} lng={parcel.lng} zoom={15} height={220} rounded />
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 px-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      El CSV no incluye coordenadas (lat, lng): no se puede mostrar la ubicación.
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <Label>Ficha técnica</Label>
                <dl className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800/70 dark:border-gray-800">
                  <Row label="ID de polígono">{parcel.polygonId}</Row>
                  <Row label="Región">
                    {parcel.region} ({parcel.regionCode})
                  </Row>
                  <Row label="Coordenadas">{hasCoords(parcel) ? `${parcel.lat.toFixed(4)}, ${parcel.lng.toFixed(4)}` : "—"}</Row>
                  <Row label="Origen del dato">
                    <span className="font-normal leading-snug">{originLabel}</span>
                  </Row>
                </dl>
              </div>
            </section>

            {/* Otras variables vs. promedio regional */}
            <section>
              <Label>Otras variables vs. promedio regional</Label>
              <p className="mb-3 mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                EVI y grados-día de {parcel.name}, comparados contra el promedio de las {regionAverages.count} parcelas de {parcel.region}.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
                      <th className="px-4 py-2.5 font-medium">Variable</th>
                      <th className="px-4 py-2.5 text-right font-medium">Parcela</th>
                      <th className="px-4 py-2.5 text-right font-medium">Promedio regional</th>
                      <th className="px-4 py-2.5 text-right font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {climateVariables.map((v) => (
                      <tr key={v.label} className="border-b border-gray-100 last:border-0 dark:border-gray-800/70">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{v.label}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{v.value}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{v.avg}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                            <v.icon size={13} className="text-gray-400 dark:text-gray-500" />
                            {v.diff}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
