import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ParcelEmblem from "./ParcelEmblem";
import MiniBarChart from "./MiniBarChart";
import PeriodToggle from "../ui/PeriodToggle";
import FeatureImportanceChart from "../charts/FeatureImportanceChart";
import { gddFull, gdd60d, gdd30d, yieldTrendFull } from "../../data/chartData";
import { globalImportance } from "../../data/shap";
import { modelSummary } from "../../data/model";
import { useParcels } from "../../context/ParcelsContext";
import { downloadCSV } from "../../utils/csv";

const TABS = ["Predicción", "Variables", "Riesgo", "Histórico"];

/**
 * Tabs con scroll horizontal suave: sin barra de scroll, con flechas a los lados
 * que desaparecen por completo junto con su espacio cuando no hay más contenido que mostrar en esa dirección.
 */
function ScrollableTabs({ tabs, active, onChange }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEdges) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro?.disconnect();
    };
  }, [updateEdges]);

  const scrollByDir = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.6, 80), behavior: "smooth" });
  };

  // Al elegir una pestaña, la centra suavemente dentro del contenedor.
  const handleSelect = (tab, event) => {
    onChange(tab);
    const el = scrollerRef.current;
    const btn = event.currentTarget;
    if (!el || !btn) return;
    const target = btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };

  const arrowBase =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-accent-600 shadow-sm transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:bg-black dark:text-accent-400 dark:hover:bg-gray-800";

  return (
    <div className="relative mt-3 flex items-center gap-2">
      {edges.left && (
        <button
          type="button"
          aria-label="Ver pestañas anteriores"
          onClick={() => scrollByDir(-1)}
          className={arrowBase}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <div
        ref={scrollerRef}
        role="tablist"
        className="flex min-w-0 flex-1 scroll-smooth gap-5 overflow-x-auto overflow-y-hidden whitespace-nowrap text-sm font-medium scrollbar-none"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={(e) => handleSelect(tab, e)}
            className={[
              "relative shrink-0 pb-3 pt-1 transition-colors duration-200 focus:outline-none focus-visible:text-accent-600",
              active === tab
                ? "text-accent-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            ].join(" ")}
          >
            {tab}
            {active === tab && (
              <motion.div
                layoutId="parcelSummaryTabIndicator"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-600"
                transition={{ type: "spring", stiffness: 450, damping: 38 }}
              />
            )}
          </button>
        ))}
      </div>

      {edges.right && (
        <button
          type="button"
          aria-label="Ver más pestañas"
          onClick={() => scrollByDir(1)}
          className={arrowBase}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

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

    // "Predicción" — promedios sobre las parcelas de la última corrida del modelo (Random Forest).
    const avgYield = parcels.reduce((s, p) => s + p.yieldEstimate, 0) / parcels.length;
    const avgScore = parcels.reduce((s, p) => s + p.score, 0) / parcels.length;
    return [
      { label: "Rendimiento estimado (promedio)", value: `${avgYield.toFixed(1)} ton/ha` },
      { label: "Margen de error (RMSE espacial)", value: `± ${modelSummary.rmse.toFixed(2)} ton/ha` },
      { label: "Score de elegibilidad (promedio)", value: `${Math.round(avgScore)} / 100` },
    ];
  }, [activeTab, parcels]);

  return (
    <div className="min-w-0 space-y-10">
    <section>
      <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">Resumen del modelo</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Rendimiento y riesgo por parcela.
      </p>
      <ParcelEmblem />

      <ScrollableTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

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
                <FeatureImportanceChart data={globalImportance.slice(0, 6)} />
              </div>
            ) : (
              <dl className="mt-2">
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
                    <dd className="font-display shrink-0 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

    </section>

    <section>
      <motion.div
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <h3 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
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
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: "var(--chart-track)" }} />
            GDD máximo regional
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: "var(--chart-2)" }} />
            GDD observado
          </li>
        </ul>
      </motion.div>
    </section>
    </div>
  );
}