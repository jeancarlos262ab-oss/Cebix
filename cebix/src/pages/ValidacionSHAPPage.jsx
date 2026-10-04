import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import { useModelInfo } from "../context/ModelInfoContext";
import { useParcels } from "../context/ParcelsContext";
import { Contributions, Label } from "../components/results/ReportParts";
import RequireAnalysis from "../components/ui/RequireAnalysis";
import RequireModelInfo from "../components/ui/RequireModelInfo";

/* ------------------------------------------------------------------ */
/* Constantes y utilidades                                             */
/* ------------------------------------------------------------------ */

const EFFECT_COLOR = {
  positivo: "var(--chart-positive)",
  negativo: "var(--chart-negative)",
  mixto: "var(--chart-mixed)",
};

const EFFECT_LABEL = {
  positivo: "Efecto positivo",
  negativo: "Efecto negativo",
  mixto: "Efecto mixto",
};

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "positivo", label: "Suman" },
  { key: "negativo", label: "Restan" },
];

// Ventanas fenológicas del ciclo (se deducen del nombre de la variable).
const WINDOWS = [
  { key: "emergencia", label: "Emergencia-macollamiento", note: "abr-may" },
  { key: "encanado", label: "Encañado", note: "jun-jul" },
  { key: "espigado", label: "Espigado-llenado", note: "ago-sep" },
  { key: "datos", label: "Calidad de datos", note: "todo el ciclo" },
];

const SIGN = { positivo: "+", negativo: "−", mixto: "±" };

function windowOf(feature) {
  const f = feature.toLowerCase();
  if (f.includes("emergencia")) return "emergencia";
  if (f.includes("encañado")) return "encanado";
  if (f.includes("espigado")) return "espigado";
  return "datos";
}

// Celdas de valor pegadas, igual que las métricas de Predicciones: un marco redondeado con líneas divisorias
// finas. El -mb-px/-mr-px esconde el borde sobrante de la última fila y columna. El icono grande sale de la
// esquina, así que cada celda recorta lo que se desborda.
function JoinedCells({ className = "", children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <div className={`-mb-px -mr-px grid ${className}`}>{children}</div>
    </div>
  );
}

const CELL = "border-b border-r border-gray-200 p-6 dark:border-gray-800";

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

const netShap = (p) => (p.shap ?? []).reduce((s, d) => s + d.impact, 0);

/* ------------------------------------------------------------------ */
/* Piezas de UI (mismo lenguaje sobrio que Predicciones)               */
/* ------------------------------------------------------------------ */

/** Encabezado de sección de la columna lateral: título + descripción opcional. */
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
      <dd className="text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/** Texto descriptivo bajo un `Label` de sección. */
function Description({ children }) {
  return <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{children}</p>;
}

/** Métrica del resumen: etiqueta fina, cifra y nota. Sin iconos ni colores. */
function SummaryStat({ label, value, hint }) {
  return (
    <div className={CELL}>
      <Label>{label}</Label>
      {value != null ? (
        <>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          {hint && <p className="mt-1.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{hint}</p>}
        </>
      ) : (
        // Sin cifra: el texto (p. ej. el nombre de una variable) ocupa el lugar principal.
        <p className="mt-3 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{hint}</p>
      )}
    </div>
  );
}

// Columnas compartidas por el encabezado y las filas de importancia global.
const IMPORTANCE_COLS =
  "grid grid-cols-[minmax(0,1fr)_minmax(5rem,30%)_3.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,30%)_3.5rem_7rem]";

function ImportanceRow({ rank, row, share, cumulative, maxValue }) {
  const color = EFFECT_COLOR[row.direction] ?? "var(--chart-neutral)";
  const width = Math.max(1.5, (Math.abs(row.value) / maxValue) * 100);

  return (
    <li className={`${IMPORTANCE_COLS} py-2.5 text-sm`}>
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">{rank}</span>
        <div className="min-w-0">
          <span className="leading-snug text-gray-800 dark:text-gray-200">{row.feature}</span>
          <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
            {WINDOWS.find((w) => w.key === windowOf(row.feature))?.label}
          </span>
        </div>
      </div>

      <span
        className="relative h-4"
        role="img"
        aria-label={`${row.feature}: |SHAP| media ${row.value}, ${share}% de la importancia total, efecto ${row.direction}`}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-800" />
        <span
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 transition-[width] duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </span>

      <span className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">
        {SIGN[row.direction] ?? ""}
        {row.value.toFixed(3)}
      </span>

      <span className="hidden text-right text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">
        {share}% · {cumulative}% acum.
      </span>
    </li>
  );
}

function WindowBreakdown({ rows }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const groups = WINDOWS.map((w) => {
    const items = rows.filter((r) => windowOf(r.feature) === w.key);
    const value = items.reduce((s, r) => s + r.value, 0);
    return { ...w, value, share: (value / total) * 100, count: items.length };
  }).filter((g) => g.count > 0);

  return (
    <ul
      className="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70"
      aria-label="Reparto de la importancia por ventana fenológica"
    >
      {groups.map((g) => (
        <li
          key={g.key}
          className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,30%)_3rem] items-center gap-x-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(6rem,38%)_3rem]"
        >
          <div className="min-w-0">
            <span className="leading-snug text-gray-800 dark:text-gray-200">{g.label}</span>
            <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
              {g.count} variable{g.count === 1 ? "" : "s"} · {g.note}
            </span>
          </div>
          <span className="relative h-4" role="img" aria-label={`${g.label}: ${Math.round(g.share)}%`}>
            <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-800" />
            <span
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 transition-[width] duration-500"
              style={{ width: `${Math.max(g.share, 1)}%`, backgroundColor: "var(--chart-1)" }}
            />
          </span>
          <span className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {Math.round(g.share)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function ValidacionSHAPPageContent() {
  const { parcels } = useParcels();
  const { info } = useModelInfo();
  const { globalImportance, modelSummary, guidingQuestions } = info;
  const [filter, setFilter] = useState("todas");
  const globalDirection = useMemo(
    () => Object.fromEntries(globalImportance.map((r) => [r.feature, r.direction])),
    [globalImportance],
  );

  /* Importancia global ------------------------------------------------ */
  const total = globalImportance.reduce((s, r) => s + r.value, 0) || 1;
  const maxValue = Math.max(...globalImportance.map((d) => Math.abs(d.value)));
  const topFeature = globalImportance[0];

  const rankedRows = useMemo(() => {
    let acc = 0;
    return globalImportance.map((row, i) => {
      acc += row.value;
      return {
        row,
        rank: i + 1,
        share: Math.round((row.value / total) * 100),
        cumulative: Math.round((acc / total) * 100),
      };
    });
  }, [total, globalImportance]);

  const visibleRows = rankedRows.filter((r) => filter === "todas" || r.row.direction === filter);
  const nPositive = globalImportance.filter((r) => r.direction === "positivo").length;
  const nNegative = globalImportance.filter((r) => r.direction === "negativo").length;

  const windowShares = useMemo(() => {
    const sums = {};
    for (const r of globalImportance) sums[windowOf(r.feature)] = (sums[windowOf(r.feature)] ?? 0) + r.value;
    const best = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
    return { key: best[0], share: Math.round((best[1] / total) * 100) };
  }, [total, globalImportance]);
  const topWindow = WINDOWS.find((w) => w.key === windowShares.key);

  /* Coherencia entre SHAP local y semáforo (calculada con las parcelas actuales) */
  const checks = useMemo(() => {
    const withShap = parcels.filter((p) => p.shap?.length);
    const eligible = withShap.filter((p) => p.score >= 70);
    const eligiblePositive = eligible.filter((p) => netShap(p) > 0).length;
    const dominantTop = withShap.filter((p) => {
      const top = [...p.shap].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];
      return top.feature === topFeature.feature;
    }).length;
    const r = pearson(
      withShap.map(netShap),
      withShap.map((p) => p.yieldEstimate),
    );
    return {
      total: withShap.length,
      eligible: eligible.length,
      eligiblePositive,
      dominantTop,
      r,
    };
  }, [parcels, topFeature.feature]);

  /* Explicación local ------------------------------------------------- */
  const selectable = useMemo(() => parcels.filter((p) => p.shap?.length), [parcels]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectable.find((p) => p.id === selectedId) ?? selectable[0];

  const localDrivers = useMemo(
    () => (selected ? [...selected.shap].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)) : []),
    [selected],
  );
  const localMax = Math.max(...localDrivers.map((d) => Math.abs(d.impact)), 0.0001);
  const localNet = selected ? netShap(selected) : 0;

  // Variables de esta parcela cuya dirección difiere del efecto promedio global.
  const divergent = localDrivers.filter((d) => {
    const g = globalDirection[d.feature];
    return g && g !== (d.impact >= 0 ? "positivo" : "negativo");
  });

  return (
    <>
      <TopBar
        title="Validación SHAP"
        subtitle="Interpretabilidad del modelo: qué variables mueven la predicción y en qué dirección."
        hideSearch
        actions={<InfoButton title="Preguntas guía de la validación" questions={guidingQuestions} />}
      />

      <div className="mt-6" aria-hidden="true" />

      <div className="grid grid-cols-1 items-start gap-12 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14 lg:px-8">
        {/* Columna izquierda: lectura de la validación */}
        <aside className="min-w-0 space-y-10">
          <section>
            <SectionHeader title="Consistencia del score" />
            <p className="font-display text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {checks.eligiblePositive}
              <span className="ml-1.5 text-base font-normal text-gray-400 dark:text-gray-500">
                de {checks.eligible} elegibles
              </span>
            </p>
            <div
              className="relative mt-4 h-4"
              role="img"
              aria-label={`${checks.eligiblePositive} de ${checks.eligible} parcelas elegibles con contribución SHAP neta positiva`}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-800" />
              <span
                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 transition-[width] duration-500"
                style={{ width: `${pct(checks.eligiblePositive, checks.eligible)}%`, backgroundColor: "var(--chart-1)" }}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              En {checks.eligiblePositive} de las {checks.eligible} parcelas con score ≥ 70 la suma de sus
              principales contribuciones SHAP empuja el rendimiento hacia arriba, como se espera de una parcela
              elegible.
              {checks.eligible - checks.eligiblePositive > 0 && (
                <>
                  {" "}
                  Las {checks.eligible - checks.eligiblePositive} restantes son elegibles aun con un SHAP neto
                  negativo, así que conviene revisarlas manualmente.
                </>
              )}
            </p>
          </section>

          <section>
            <SectionHeader title="Datos de la validación" />
            <dl>
              <DetailRow label="Variable dominante como driver #1">
                {checks.dominantTop}
                <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">de {checks.total}</span>
              </DetailRow>
              <DetailRow label="Variables que suman / restan">
                {nPositive} / {nNegative}
              </DetailRow>
              <DetailRow label="Parcelas de entrenamiento">{modelSummary.trainingParcels}</DetailRow>
              <DetailRow label="|SHAP| media máxima">{topFeature.value}</DetailRow>
            </dl>
            <p className="mt-6 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              Cada parcela guarda sus 4 variables con mayor |SHAP|; los totales por parcela se calculan sobre esas 4.
              {topFeature.feature.toLowerCase().includes("precipitación") &&
                " Nota: la precipitación está parcialmente confundida con el estado por la resolución de CHIRPS (~5 km)."}
            </p>
          </section>
        </aside>

        {/* Contenido principal */}
        <div className="min-w-0 space-y-10">
          {/* Resumen */}
          <section aria-label="Resumen de la validación">
            <JoinedCells className="grid-cols-2 lg:grid-cols-4">
              <SummaryStat
                label="Variable dominante"
                value={`${Math.round((topFeature.value / total) * 100)}%`}
                hint={topFeature.feature}
              />
              <SummaryStat
                label="Ventana más crítica"
                value={`${windowShares.share}%`}
                hint={`${topWindow.label} (${topWindow.note})`}
              />
              <SummaryStat
                label="Coherencia con el semáforo"
                value={`${pct(checks.eligiblePositive, checks.eligible)}%`}
                hint={`${checks.eligiblePositive} de ${checks.eligible} parcelas elegibles con SHAP neto positivo`}
              />
              <SummaryStat
                label="Correlación SHAP – rendimiento"
                value={checks.r == null ? "—" : checks.r.toFixed(2)}
                hint={`r de Pearson sobre ${checks.total} parcelas`}
              />
            </JoinedCells>
          </section>

          {/* 1. Importancia global */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <Label>Importancia global de variables</Label>
                <Description>
                  {`Media de |SHAP| sobre las ${modelSummary.shapParcels} parcelas del reto (entrenamiento y evaluación). Las 3 primeras variables concentran el ${rankedRows[2].cumulative}% de la importancia.`}
                </Description>
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por efecto">
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 ${
                        active
                          ? "border-gray-300 bg-gray-100 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {Object.keys(EFFECT_LABEL)
                .filter((k) => globalImportance.some((r) => r.direction === k))
                .map((k) => (
                  <li key={k} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="h-2 w-2 shrink-0" style={{ backgroundColor: EFFECT_COLOR[k] }} />
                    {EFFECT_LABEL[k]}
                  </li>
                ))}
            </ul>

            <div className="mt-3">
              <div className={`${IMPORTANCE_COLS} pb-2 text-[11px] text-gray-400 dark:text-gray-500`}>
                <span className="pl-8">Variable</span>
                <span>Peso relativo</span>
                <span className="text-right">|SHAP|</span>
                <span className="hidden text-right sm:block">Parte · acumulado</span>
              </div>
              <ol className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70">
                {visibleRows.map(({ row, rank, share, cumulative }) => (
                  <ImportanceRow
                    key={row.feature}
                    rank={rank}
                    row={row}
                    share={share}
                    cumulative={cumulative}
                    maxValue={maxValue}
                  />
                ))}
              </ol>
            </div>
          </section>

          {/* 2. Por ventana fenológica */}
          <section>
            <Label>Importancia por ventana fenológica</Label>
            <Description>
              Cómo se reparte la importancia entre las etapas del ciclo: indica cuándo es más crítico monitorear la
              parcela.
            </Description>
            <WindowBreakdown rows={globalImportance} />
          </section>

          {/* 3. Explicación local */}
          <section>
            <Label>Explicación por parcela</Label>
            <Description>
              Contribución SHAP local de las 4 variables con mayor peso en la parcela. Las barras a la derecha suman
              al rendimiento estimado; a la izquierda restan.
            </Description>

            {selected ? (
              <>
                <div className="relative mt-4 max-w-md">
                  <select
                    value={selected.id}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                    aria-label="Parcela a explicar"
                    className="w-full appearance-none rounded-full border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-gray-800 shadow-xs focus:border-accent-500 focus:outline-hidden focus:ring-1 focus:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-200"
                  >
                    {selectable.map((p) => (
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

                <JoinedCells className="mt-6 grid-cols-2 sm:grid-cols-4">
                  <SummaryStat
                    label="Rendimiento estimado"
                    value={
                      <>
                        {selected.yieldEstimate.toFixed(2)}
                        <span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">ton/ha</span>
                      </>
                    }
                  />
                  <SummaryStat
                    label="Score"
                    value={
                      <>
                        {selected.score}
                        <span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">{selected.risk}</span>
                      </>
                    }
                  />
                  <SummaryStat
                    label="SHAP neto (top 4)"
                    value={`${localNet >= 0 ? "+" : "−"}${Math.abs(localNet).toFixed(3)}`}
                  />
                  <SummaryStat label="Variable dominante" value={null} hint={localDrivers[0].feature} />
                </JoinedCells>

                <Contributions
                  data={localDrivers.map((d) => ({
                    feature: d.feature,
                    value: Math.abs(d.impact),
                    direction: d.impact >= 0 ? "positivo" : "negativo",
                  }))}
                />

                {divergent.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                    En esta parcela {divergent.map((d) => d.feature).join(", ")}{" "}
                    {divergent.length === 1 ? "actúa" : "actúan"} en dirección distinta al efecto promedio global
                    (varía según la parcela).
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Aún no hay parcelas con contribuciones SHAP para explicar.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function ValidacionSHAPPage() {
  return (
    <RequireAnalysis title="Validación SHAP" subtitle="Qué variables explican cada predicción." >
      <RequireModelInfo>
        <ValidacionSHAPPageContent />
      </RequireModelInfo>
    </RequireAnalysis>
  );
}
