import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ParcelEmblem from "./ParcelEmblem";
import MiniBarChart from "./MiniBarChart";
import PeriodToggle from "../ui/PeriodToggle";
import FeatureImportanceChart from "../charts/FeatureImportanceChart";
import { gddFull, gdd60d, gdd30d, yieldTrendFull } from "../../data/chartData";
import { globalImportance } from "../../data/shap";
import { useParcels } from "../../context/ParcelsContext";
import { downloadCSV } from "../../utils/csv";

const TABS = ["Predicción", "Variables", "Riesgo", "Histórico"];
const PERIODS = ["Ciclo completo", "60 días", "30 días"];

const BARS_BY_PERIOD = {
  "Ciclo completo": gddFull,
  "60 días": gdd60d,
  "30 días": gdd30d,
};

function exportGdd(period) {
  downloadCSV(
    `cebix-gdd-${period.toLowerCase().replace(/\s+/g, "-")}.csv`,
    [
      { key: "month", label: "Mes" },
      { key: "budget", label: "GDD máximo regional" },
      { key: "spent", label: "GDD observado" },
    ],
    BARS_BY_PERIOD[period]
  );
}

export default function ParcelSummary() {
  const { parcels } = useParcels();
  const [activeTab, setActiveTab] = useState("Predicción");
  const [period, setPeriod] = useState("Ciclo completo");

  const summaryRows = useMemo(() => {
    if (activeTab === "Variables") {
      return globalImportance.slice(0, 3).map((f) => ({
        label: f.feature,
        value: `${f.direction === "negativo" ? "-" : "+"}${f.value.toFixed(3)}`,
      }));
    }

    if (activeTab === "Riesgo") {
      const green = parcels.filter((p) => p.riskColor === "green").length;
      const yellow = parcels.filter((p) => p.riskColor === "yellow").length;
      const red = parcels.filter((p) => p.riskColor === "red").length;
      return [
        { label: "Elegibles (score ≥ 70)", value: `${green} parcelas` },
        { label: "Revisión manual (45–69)", value: `${yellow} parcelas` },
        { label: "Alto riesgo (< 45)", value: `${red} parcelas` },
      ];
    }

    if (activeTab === "Histórico") {
      const first = yieldTrendFull[0];
      const last = yieldTrendFull[yieldTrendFull.length - 1];
      const growth = last.value - first.value;
      return [
        { label: `Rendimiento en ${first.month} (inicio de ciclo)`, value: `${first.value.toFixed(2)} ton/ha` },
        { label: `Rendimiento en ${last.month} (a cosecha)`, value: `${last.value.toFixed(2)} ton/ha` },
        { label: "Crecimiento acumulado del ciclo", value: `+${growth.toFixed(2)} ton/ha` },
      ];
    }

    // "Predicción" — promedios sobre las 197 parcelas del modelo Ridge validado espacialmente.
    const avgYield = parcels.reduce((s, p) => s + p.yieldEstimate, 0) / parcels.length;
    const avgScore = parcels.reduce((s, p) => s + p.score, 0) / parcels.length;
    return [
      { label: "Rendimiento estimado (promedio)", value: `${avgYield.toFixed(1)} ton/ha` },
      { label: "Margen de error (RMSE espacial)", value: "± 0.76 ton/ha" },
      { label: "Score de elegibilidad (promedio)", value: `${Math.round(avgScore)} / 100` },
    ];
  }, [activeTab, parcels]);

  return (
    <section className="bg-white dark:bg-black">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumen del modelo</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Rendimiento y riesgo por parcela.
      </p>
      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <ParcelEmblem />

      <div className="mt-2 flex gap-5 border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "relative -mb-px pb-2.5 transition-colors duration-200",
              activeTab === tab
                ? "text-accent-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            ].join(" ")}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="parcelSummaryTabIndicator"
                className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-accent-600"
                transition={{ type: "spring", stiffness: 450, damping: 38 }}
              />
            )}
          </button>
        ))}
      </div>

      <motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
          >
            {activeTab === "Variables" ? (
              <div className="mt-4">
                <FeatureImportanceChart data={globalImportance.slice(0, 6)} height={180} />
              </div>
            ) : (
              <dl className="mt-4 space-y-3">
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
                    <dd className="font-sora shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }} className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Variables por etapa del ciclo
        </h3>
        <div className="mt-3">
          <PeriodToggle
            value={period}
            options={PERIODS}
            onChange={setPeriod}
            withMenu
            onMenuAction={() => exportGdd(period)}
            menuLabel="Descargar CSV de esta serie"
          />
        </div>
        <div className="mt-4">
          <MiniBarChart data={BARS_BY_PERIOD[period]} />
        </div>
      </motion.div>
    </section>
  );
}
