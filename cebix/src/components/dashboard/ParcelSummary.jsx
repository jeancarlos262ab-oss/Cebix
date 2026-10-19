import { parcelWarnings } from "../../utils/reliability";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ParcelEmblem from "./ParcelEmblem";
import MiniBarChart from "./MiniBarChart";
import FeatureImportanceChart from "../charts/FeatureImportanceChart";
import { LinesSkeleton } from "../ui/PageSkeleton";
import { useModelInfo } from "../../context/ModelInfoContext";
import { useParcels } from "../../context/ParcelsContext";
import { yieldByRegion, yieldRange } from "../../utils/parcelStats";
import { formatFixed } from "../../utils/intl";

const TABS = ["Predicción", "Variables", "Nivel", "Rango"];

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

  
  const handleSelect = (tab, event) => {
    onChange(tab);
    const el = scrollerRef.current;
    const btn = event.currentTarget;
    if (!el || !btn) return;
    const target = btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };

  const arrowBase =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200";

  return (
    <div className="relative mt-3 flex items-center gap-2">
      {edges.left && (
        <button
          type="button"
          aria-label="Ver pestañas anteriores"
          onClick={() => scrollByDir(-1)}
          className={arrowBase}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
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
              "relative shrink-0 pb-3 pt-1 transition-colors duration-200 focus:outline-hidden focus-visible:text-gray-900",
              active === tab
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            ].join(" ")}
          >
            {tab}
            {active === tab && (
              <motion.div
                layoutId="parcelSummaryTabIndicator"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-500"
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
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

export default function ParcelSummary() {
  const { parcels } = useParcels();
  const { info } = useModelInfo();
  const importance = useMemo(() => info?.globalImportance ?? [], [info]);
  const rmse = info?.modelSummary?.rmse;
  const [activeTab, setActiveTab] = useState("Predicción");
  const regionRows = useMemo(() => yieldByRegion(parcels), [parcels]);

  const summaryRows = useMemo(() => {
    if (activeTab === "Variables") {
      return importance.slice(0, 3).map((f) => ({
        label: f.feature,
        value: `${f.direction === "negativo" ? "-" : "+"}${formatFixed(f.value, 3)}`,
      }));
    }

    if (activeTab === "Nivel") {
      const green = parcels.filter((p) => p.riskColor === "green").length;
      const yellow = parcels.filter((p) => p.riskColor === "yellow").length;
      const red = parcels.filter((p) => p.riskColor === "red").length;
      return [
        { label: "Rendimiento alto (índice ≥ 70)", value: `${green} parcelas` },
        { label: "Rendimiento medio (45–69)", value: `${yellow} parcelas` },
        { label: "Rendimiento bajo (< 45)", value: `${red} parcelas` },
      ];
    }

    if (activeTab === "Rango") {
      const range = yieldRange(parcels);
      if (!range) return [];
      return [
        { label: "Rendimiento mínimo estimado", value: `${formatFixed(range.min, 1)} ton/ha` },
        { label: "Rendimiento máximo estimado", value: `${formatFixed(range.max, 1)} ton/ha` },
        { label: "Rango (máx − mín)", value: `${formatFixed(range.spread, 1)} ton/ha` },
      ];
    }

    
    const avgYield = parcels.reduce((s, p) => s + p.yieldEstimate, 0) / parcels.length;
    const avgScore = parcels.reduce((s, p) => s + p.score, 0) / parcels.length;
    const outside = parcels.filter((p) => parcelWarnings(p, info?.dominio).length > 0).length;
    return [
      { label: "Rendimiento estimado (promedio)", value: `${formatFixed(avgYield, 1)} ton/ha` },
      ...(outside > 0 ? [{ label: "Parcelas fuera de rango", value: `${outside} de ${parcels.length} (menos confiables)` }] : []),
      { label: "Margen de error (RMSE espacial)", value: rmse == null ? "—" : `± ${formatFixed(rmse, 1)} ton/ha` },
      { label: "Índice de rendimiento (promedio)", value: `${Math.round(avgScore)} / 100` },
    ];
  }, [activeTab, parcels, importance, rmse, info]);

  return (
    <div className="min-w-0 space-y-10">
    <section>
      <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">Resumen del modelo</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Rendimiento por parcela.
      </p>
      <ParcelEmblem />

      <ScrollableTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div>
        <div key={activeTab} className="fade-in-up">
            {activeTab === "Variables" ? (
              <div className="mt-4">
                {importance.length ? (
                  <FeatureImportanceChart data={importance.slice(0, 6)} />
                ) : (
                  <LinesSkeleton lines={6} className="app-skeleton py-6" />
                )}
              </div>
            ) : (
              <dl className="mt-2 divide-y divide-gray-100 border-b border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70">
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
                    <dd className="font-display shrink-0 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
        </div>
      </div>

    </section>

    <section>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
            Rendimiento estimado por estado
          </h3>
        </div>
        <div className="mt-4">
          <MiniBarChart data={regionRows} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: "var(--chart-track)" }} />
            Máximo estimado
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: "var(--accent-500)" }} />
            Promedio estimado
          </li>
        </ul>
      </div>
    </section>
    </div>
  );
}