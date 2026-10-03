import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  CircleCheck,
  CloudRain,
  Link2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import StatCard from "../components/ui/StatCard";
import InfoButton from "../components/ui/InfoButton";
import { globalImportance } from "../data/shap";
import { guidingQuestions, modelSummary } from "../data/model";
import { useParcels } from "../context/ParcelsContext";
import RequireAnalysis from "../components/ui/RequireAnalysis";

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
  { key: "emergencia", label: "Emergencia-macollamiento", note: "abr-may", color: "var(--chart-1)" },
  { key: "encanado", label: "Encañado", note: "jun-jul", color: "var(--chart-2)" },
  { key: "espigado", label: "Espigado-llenado", note: "ago-sep", color: "var(--chart-3)" },
  { key: "datos", label: "Calidad de datos", note: "todo el ciclo", color: "var(--chart-neutral)" },
];

function windowOf(feature) {
  const f = feature.toLowerCase();
  if (f.includes("emergencia")) return "emergencia";
  if (f.includes("encañado")) return "encanado";
  if (f.includes("espigado")) return "espigado";
  return "datos";
}

const PRECIP = "Precipitación en emergencia-macollamiento";

// Recuadro del sistema de diseño: cuadrado, borde fino, sin relleno (igual que Modelo / Predicciones).
const CARD = "rounded-2xl border border-gray-200 p-5 dark:border-gray-800";
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

const CELL = "relative overflow-hidden border-b border-r border-gray-200 p-5 dark:border-gray-800";

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

const globalDirection = Object.fromEntries(globalImportance.map((r) => [r.feature, r.direction]));

/* ------------------------------------------------------------------ */
/* Piezas de UI                                                        */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, description, aside }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {aside}
    </div>
  );
}

function ImportanceRow({ rank, row, share, cumulative, maxValue }) {
  const color = EFFECT_COLOR[row.direction] ?? "var(--chart-neutral)";
  const DirIcon = row.direction === "negativo" ? TrendingDown : TrendingUp;
  const width = Math.max(1.5, (Math.abs(row.value) / maxValue) * 100);

  return (
    <li className="flex flex-col gap-2 py-3.5 md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 items-start gap-3 md:w-72 md:shrink-0">
        <span className="w-5 shrink-0 pt-px text-right text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
          {rank}
        </span>
        <div className="min-w-0">
          <span className="text-sm leading-snug text-gray-900 dark:text-gray-100">{row.feature}</span>
          <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
            {WINDOWS.find((w) => w.key === windowOf(row.feature))?.label}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 pl-8 md:pl-0">
        <div
          className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
          role="img"
          aria-label={`${row.feature}: |SHAP| media ${row.value}, ${share}% de la importancia total, efecto ${row.direction}`}
        >
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>
        <span className="flex w-16 shrink-0 items-center justify-end gap-1.5 text-sm tabular-nums text-gray-900 dark:text-gray-100">
          <DirIcon size={14} style={{ color }} aria-hidden="true" />
          <span className="font-display font-semibold">{row.value.toFixed(3)}</span>
        </span>
        <span className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">
          {share}% <span className="text-gray-300 dark:text-gray-600">·</span> {cumulative}% acum.
        </span>
      </div>
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
    <div>
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full" role="img" aria-label="Reparto de la importancia por ventana fenológica">
        {groups.map((g) => (
          <div
            key={g.key}
            className="h-full transition-[width] duration-500"
            style={{ width: `${Math.max(g.share, 1)}%`, backgroundColor: g.color }}
            title={`${g.label}: ${Math.round(g.share)}%`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.key} className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-gray-900 dark:text-gray-100">{g.label}</span>
                <span className="font-display text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {Math.round(g.share)}%
                </span>
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {g.count} variable{g.count === 1 ? "" : "s"} · {g.note}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocalDriverRow({ driver, maxAbs }) {
  const positive = driver.impact >= 0;
  const color = positive ? EFFECT_COLOR.positivo : EFFECT_COLOR.negativo;
  const half = Math.max(1, (Math.abs(driver.impact) / maxAbs) * 50);
  const globalDir = globalDirection[driver.feature];
  const matches = globalDir ? globalDir === (positive ? "positivo" : "negativo") : null;

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm leading-snug text-gray-900 dark:text-gray-100">{driver.feature}</span>
        <span
          className="font-display shrink-0 text-sm font-semibold tabular-nums"
          style={{ color }}
        >
          {positive ? "+" : "−"}
          {Math.abs(driver.impact).toFixed(3)}
        </span>
      </div>

      {/* Barra divergente: el centro es SHAP = 0 */}
      <div
        className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="img"
        aria-label={`${driver.feature}: contribución ${positive ? "positiva" : "negativa"} de ${Math.abs(driver.impact).toFixed(3)}`}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-400 dark:bg-gray-500" aria-hidden="true" />
        <div
          className="absolute inset-y-0 transition-[width] duration-500"
          style={{
            width: `${half}%`,
            backgroundColor: color,
            ...(positive ? { left: "50%" } : { right: "50%" }),
          }}
        />
      </div>

      {matches !== null && (
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          {matches
            ? "Misma dirección que el efecto global del modelo"
            : "Dirección distinta al efecto promedio global (varía según la parcela)"}
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function ValidacionSHAPPageContent() {
  const { parcels } = useParcels();
  const [filter, setFilter] = useState("todas");

  /* Importancia global ------------------------------------------------ */
  const total = globalImportance.reduce((s, r) => s + r.value, 0);
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
  }, [total]);

  const visibleRows = rankedRows.filter((r) => filter === "todas" || r.row.direction === filter);
  const nPositive = globalImportance.filter((r) => r.direction === "positivo").length;
  const nNegative = globalImportance.filter((r) => r.direction === "negativo").length;

  const windowShares = useMemo(() => {
    const sums = {};
    for (const r of globalImportance) sums[windowOf(r.feature)] = (sums[windowOf(r.feature)] ?? 0) + r.value;
    const best = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
    return { key: best[0], share: Math.round((best[1] / total) * 100) };
  }, [total]);
  const topWindow = WINDOWS.find((w) => w.key === windowShares.key);

  /* Coherencia entre SHAP local y semáforo (calculada con las parcelas actuales) */
  const checks = useMemo(() => {
    const withShap = parcels.filter((p) => p.shap?.length);
    const eligible = withShap.filter((p) => p.score >= 70);
    const eligiblePositive = eligible.filter((p) => netShap(p) > 0).length;
    const precipTop = withShap.filter((p) => {
      const top = [...p.shap].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];
      return top.feature === PRECIP;
    }).length;
    const r = pearson(
      withShap.map(netShap),
      withShap.map((p) => p.yieldEstimate),
    );
    return {
      total: withShap.length,
      eligible: eligible.length,
      eligiblePositive,
      precipTop,
      r,
    };
  }, [parcels]);

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

  return (
    <>
      <TopBar
        title="Validación SHAP"
        subtitle="Interpretabilidad del modelo: qué variables mueven la predicción y en qué dirección."
        hideSearch
        actions={<InfoButton title="Preguntas guía de la validación" questions={guidingQuestions} />}
      />

      <div className="mt-6" aria-hidden="true" />

      {/* Resumen */}
      <section
        aria-label="Resumen de la validación"
        className="px-4 sm:px-6 lg:px-8"
      >
        <JoinedCells className="grid-cols-2 lg:grid-cols-4">
          <div className={CELL}>
            <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-500" aria-hidden="true" />
            <StatCard
              label="Variable dominante"
              value={`${Math.round((topFeature.value / total) * 100)}%`}
              hint="Precipitación en emergencia-macollamiento"
              icon={CloudRain}
              tone="brand"
              cornerIcon
            />
          </div>
          <div className={CELL}>
            <StatCard
              label="Ventana más crítica"
              value={`${windowShares.share}%`}
              hint={`${topWindow.label} (${topWindow.note})`}
              icon={CalendarRange}
              tone="ndvi"
              cornerIcon
            />
          </div>
          <div className={CELL}>
            <StatCard
              label="Coherencia con el semáforo"
              value={`${pct(checks.eligiblePositive, checks.eligible)}%`}
              hint={`${checks.eligiblePositive} de ${checks.eligible} parcelas elegibles con SHAP neto positivo`}
              icon={CircleCheck}
              tone="navy"
              cornerIcon
            />
          </div>
          <div className={CELL}>
            <StatCard
              label="Correlación SHAP – rendimiento"
              value={checks.r == null ? "—" : checks.r.toFixed(2)}
              hint={`r de Pearson sobre ${checks.total} parcelas`}
              icon={Link2}
              tone="navy"
              cornerIcon
            />
          </div>
        </JoinedCells>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        {/* Rail izquierdo: lectura de la validación */}
        <aside className={`min-w-0 ${CARD}`}>
          <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
            Consistencia del score
          </h2>

          <p className="mt-4 font-display text-3xl font-bold text-gray-900 dark:text-gray-100">
            {checks.eligiblePositive}
            <span className="ml-1.5 text-base font-medium text-gray-400 dark:text-gray-500">
              de {checks.eligible} elegibles
            </span>
          </p>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="img"
            aria-label={`${checks.eligiblePositive} de ${checks.eligible} parcelas elegibles con contribución SHAP neta positiva`}
          >
            <div
              className="h-full transition-[width] duration-500"
              style={{
                width: `${pct(checks.eligiblePositive, checks.eligible)}%`,
                backgroundColor: "var(--chart-1)",
              }}
            />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            En {checks.eligiblePositive} de las {checks.eligible} parcelas con score ≥ 70 la suma de sus
            principales contribuciones SHAP empuja el rendimiento hacia arriba, como se espera de una
            parcela elegible.
            {checks.eligible - checks.eligiblePositive > 0 && (
              <>
                {" "}
                Las {checks.eligible - checks.eligiblePositive} restantes son elegibles aun con un SHAP neto
                negativo, así que conviene revisarlas manualmente.
              </>
            )}
          </p>

          <dl className="mt-6 text-sm">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Precipitación como driver #1</dt>
              <dd className="font-display font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {checks.precipTop}
                <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                  de {checks.total}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Variables que suman / restan</dt>
              <dd className="font-display font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {nPositive} / {nNegative}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Parcelas de entrenamiento</dt>
              <dd className="font-display font-bold text-gray-900 dark:text-gray-100">
                {modelSummary.trainingParcels}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">|SHAP| media máxima</dt>
              <dd className="font-display font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {topFeature.value}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            Cada parcela guarda sus 4 variables con mayor |SHAP|; los totales por parcela se calculan sobre
            esas 4. Nota: la precipitación está parcialmente confundida con el estado por la resolución de
            CHIRPS (~5 km).
          </p>
        </aside>

        {/* Contenido principal */}
        <div className="min-w-0 space-y-4">
          {/* 1. Importancia global */}
          <section className={CARD}>
            <SectionHeader
              title="Importancia global de variables"
              description={`Media de |SHAP| sobre las ${modelSummary.trainingParcels} parcelas de entrenamiento. Las 3 primeras variables concentran el ${rankedRows[2].cumulative}% de la importancia.`}
              aside={
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por efecto">
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                          active
                            ? "border-accent-500 bg-accent-500 text-accent-contrast"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              }
            />

            <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1.5">
              {Object.keys(EFFECT_LABEL)
                .filter((k) => globalImportance.some((r) => r.direction === k))
                .map((k) => (
                  <li key={k} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: EFFECT_COLOR[k] }} />
                    {EFFECT_LABEL[k]}
                  </li>
                ))}
            </ul>

            <ol>
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
          </section>

          {/* 2. Por ventana fenológica */}
          <section className={CARD}>
            <SectionHeader
              title="Importancia por ventana fenológica"
              description="Cómo se reparte la importancia entre las etapas del ciclo: indica cuándo es más crítico monitorear la parcela."
            />
            <WindowBreakdown rows={globalImportance} />
          </section>

          {/* 3. Explicación local */}
          <section className={CARD}>
            <SectionHeader
              title="Explicación por parcela"
              description="Contribución SHAP local de las 4 variables con mayor peso en la parcela. Las barras a la derecha suman al rendimiento estimado; a la izquierda restan."
            />

            {selected ? (
              <>
                <div className="relative max-w-md">
                  <select
                    value={selected.id}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                    aria-label="Parcela a explicar"
                    className="w-full appearance-none rounded-full border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-gray-800 dark:bg-black dark:text-gray-200"
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

                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Rendimiento estimado</dt>
                    <dd className="font-display mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {selected.yieldEstimate.toFixed(2)}
                      <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">ton/ha</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Score</dt>
                    <dd className="font-display mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {selected.score}
                      <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                        {selected.risk}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">SHAP neto (top 4)</dt>
                    <dd
                      className="font-display mt-1 text-lg font-bold tabular-nums"
                      style={{ color: localNet >= 0 ? EFFECT_COLOR.positivo : EFFECT_COLOR.negativo }}
                    >
                      {localNet >= 0 ? "+" : "−"}
                      {Math.abs(localNet).toFixed(3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Variable dominante</dt>
                    <dd className="mt-1 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
                      {localDrivers[0].feature}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-4">
                  {localDrivers.map((d) => (
                    <LocalDriverRow key={d.feature} driver={d} maxAbs={localMax} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
      <ValidacionSHAPPageContent />
    </RequireAnalysis>
  );
}
