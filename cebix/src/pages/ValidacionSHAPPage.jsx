import { MODES, usePredictionMode } from "../services/predictionMode";
import { MODE_DESC, MODE_LABEL } from "../utils/reportMode";
import { useMemo, useState } from "react";
import { BarChart3, CalendarRange, ChevronDown, ImageIcon, Layers, Sigma } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import InfoButton from "../components/ui/InfoButton";
import { useModelInfo } from "../context/ModelInfoContext";
import { useParcels } from "../context/ParcelsContext";
import { Contributions, Label } from "../components/results/ReportParts";
import RequireAnalysis from "../components/ui/RequireAnalysis";
import RequireModelInfo from "../components/ui/RequireModelInfo";
import { Card, DIVIDE, Heading, HeroPhoto, LINE, Reveal } from "../components/ui/PageKit";
import heroImage from "../assets/shap/imagen-1.webp";
import { formatFixed } from "../utils/intl";

const FILES = import.meta.glob("../assets/shap/imagen-*.webp", { eager: true, import: "default" });
const imageFor = (n) => Object.entries(FILES).find(([path]) => new RegExp(`/imagen-${n}\\.[a-z]+$`).test(path))?.[1];

const SLOTS = {
  2: { title: "Parcelas de cebada desde el aire", hint: "Vista aérea amplia de parcelas. Abre la sección de lectura de SHAP.", size: "1600 × 700", caption: "Cada parcela recibe su propia explicación" },
  3: { title: "Espigas de cebada al sol", hint: "Espigas doradas en primer plano, con luz de día.", size: "1200 × 800", caption: "Del dato satelital a la espiga" },
  4: { title: "Espiga de cebada con gotas de lluvia", hint: "Espiga verde con gotas de agua: ilustra la precipitación, la variable que más pesa.", size: "1200 × 480", caption: "Lluvia: la variable que más pesa" },
};

function ShapImage({ n, className = "", position = "center" }) {
  const src = imageFor(n);
  const slot = SLOTS[n];
  if (src) {
    return (
      <figure className={`group relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${className}`}>
        <img src={src} alt={slot.title} loading="lazy" decoding="async" className="absolute inset-0 size-full transform-gpu object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100" style={{ objectPosition: position }} />
        <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">{slot.caption}</figcaption>
      </figure>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-gray-50 px-6 py-8 text-center dark:bg-gray-900/60 ${className}`}>
      <ImageIcon size={20} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Imagen {n}: {slot.title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">{slot.hint}</p>
      <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{slot.size} px</p>
    </div>
  );
}

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

function JoinedCells({ className = "", bare = false, children }) {
  return (
    <div className={bare ? "overflow-hidden" : "overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800"}>
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

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-display text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

function SummaryStat({ label, value, hint }) {
  return (
    <div className={CELL}>
      <Label>{label}</Label>
      {value != null ? (
        <>
          <p className="mt-3 font-display text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          {hint && <p className="mt-1.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{hint}</p>}
        </>
      ) : (
        
        <p className="mt-3 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{hint}</p>
      )}
    </div>
  );
}

const IMPORTANCE_COLS =
  "grid grid-cols-[minmax(0,1fr)_minmax(5rem,30%)_3.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,30%)_3.5rem_7rem]";

function ImportanceRow({ rank, row, share, cumulative, maxValue }) {
  const color = EFFECT_COLOR[row.direction] ?? "var(--chart-neutral)";
  const width = Math.max(1.5, (Math.abs(row.value) / maxValue) * 100);

  return (
    <li className={`${IMPORTANCE_COLS} py-2.5 text-sm`}>
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="w-5 shrink-0 text-right font-display text-xs tabular-nums text-gray-400 dark:text-gray-500">{rank}</span>
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

      <span className="text-right font-display font-medium tabular-nums text-gray-900 dark:text-gray-100">
        {SIGN[row.direction] ?? ""}
        {formatFixed(row.value, 3)}
      </span>

      <span className="hidden text-right font-display text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">
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
          <span className="text-right font-display font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {Math.round(g.share)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function ModeTabs({ mode, onChange }) {
  return (
    <div role="radiogroup" aria-label="Modo del modelo a validar" className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 xl:min-w-0 xl:flex-[2]">
      {MODES.map((key, i) => {
        const active = key === mode;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={`flex min-h-11 items-center justify-center border-gray-200 px-3 py-2 dark:border-gray-800 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""} text-center font-display text-[13px] font-medium leading-tight transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 ${
              active
                ? "bg-accent-600 text-white dark:bg-accent-400 dark:text-black"
                : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-black dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {MODE_LABEL[key]}
          </button>
        );
      })}
    </div>
  );
}

function ValidacionSHAPPageContent() {
  const { parcels: allParcels } = useParcels();
  const { info } = useModelInfo();
  const { modelSummary, guidingQuestions } = info;
  
  
  const [globalMode] = usePredictionMode();
  const [predMode, setPredMode] = useState(globalMode);
  const parcels = useMemo(() => allParcels.filter((p) => (p.modo ?? "lluvia") === predMode), [allParcels, predMode]);
  const globalImportance = info.modelModes?.[predMode]?.importance?.length ? info.modelModes[predMode].importance : info.globalImportance;
  const [filter, setFilter] = useState("todas");
  const globalDirection = useMemo(
    () => Object.fromEntries(globalImportance.map((r) => [r.feature, r.direction])),
    [globalImportance],
  );

  
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

  
  const selectable = useMemo(() => parcels.filter((p) => p.shap?.length), [parcels]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectable.find((p) => p.id === selectedId) ?? selectable[0];

  const localDrivers = useMemo(
    () => (selected ? [...selected.shap].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)) : []),
    [selected],
  );
  const localNet = selected ? netShap(selected) : 0;

  
  const divergent = localDrivers.filter((d) => {
    const g = globalDirection[d.feature];
    return g && g !== (d.impact >= 0 ? "positivo" : "negativo");
  });

  return (
    <div className="relative isolate overflow-x-clip">
      {}
      <HeroPhoto src={heroImage} position="50% 45%" />

      <TopBar
        title="Validación SHAP"
        subtitle="Interpretabilidad del modelo: qué variables mueven la predicción y en qué dirección."
        hideSearch
        actions={<InfoButton title="Preguntas guía de la validación" questions={guidingQuestions} />}
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {}
        <Reveal className="relative pb-6 pt-10 lg:pt-16">
          <div className="max-w-xl">
            <Heading title="Qué mueve la predicción" bebas sizeClass="text-3xl sm:text-4xl">
              SHAP reparte cada predicción entre las variables que la produjeron. Aquí se revisa que el modelo dé
              peso a lo que debe, que lo haga en la dirección esperada y que el semáforo sea coherente con ello.
            </Heading>
          </div>
          {}
          <div className="mt-10 flex flex-col gap-8 xl:flex-row xl:items-center xl:gap-10">
            <dl className="grid min-w-0 flex-[3] gap-y-6 sm:grid-cols-3 sm:divide-x sm:divide-gray-200 sm:dark:divide-gray-800">
              {[
                {
                  label: "Variable dominante",
                  big: `${Math.round((topFeature.value / total) * 100)}%`,
                  note: topFeature.feature,
                },
                {
                  label: "Ventana más crítica",
                  big: `${windowShares.share}%`,
                  note: `${topWindow.label} · ${topWindow.note}`,
                },
                {
                  label: "Coherencia con el semáforo",
                  big: checks.eligible ? `${pct(checks.eligiblePositive, checks.eligible)}%` : "—",
                  note: checks.eligible
                    ? `${checks.eligiblePositive} de ${checks.eligible} parcelas de rendimiento alto`
                    : "Aún no hay parcelas de rendimiento alto para comparar",
                },
              ].map((f) => (
                <div key={f.label} className="min-w-0 sm:px-8 sm:first:pl-0 sm:last:pr-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{f.label}</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tabular-nums text-accent-600 dark:text-accent-400 sm:text-3xl">{f.big}</dd>
                  <dd className="mt-2 text-sm leading-snug text-gray-600 dark:text-gray-300">{f.note}</dd>
                </div>
              ))}
            </dl>
            <ModeTabs mode={predMode} onChange={setPredMode} />
          </div>
        </Reveal>

        {}
        <Reveal>
          <ShapImage n={2} position="50% 55%" className={`h-44 rounded-xl border sm:h-56 lg:h-64 ${LINE}`} />
        </Reveal>

        {}
        <Reveal>
              <Card icon={Sigma} title="Resumen de la validación">
                <JoinedCells bare className="grid-cols-2 lg:grid-cols-4">
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
                    hint={`${checks.eligiblePositive} de ${checks.eligible} parcelas de rendimiento alto con SHAP neto positivo`}
                  />
                  <SummaryStat
                    label="Correlación SHAP – rendimiento"
                    value={checks.r == null ? "—" : formatFixed(checks.r, 2)}
                    hint={`r de Pearson sobre ${checks.total} parcelas`}
                  />
                </JoinedCells>
              </Card>
            </Reveal>

        {}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
          <Reveal className="min-w-0 h-full">
              <Card
                className="h-full"
                icon={BarChart3}
                title="Importancia global de variables"
                description={`Media de |SHAP| sobre las ${modelSummary.shapParcels} parcelas (entrenamiento y evaluación). ${rankedRows.length > 1 ? `Las ${Math.min(3, rankedRows.length)} primeras variables concentran el ${rankedRows[Math.min(3, rankedRows.length) - 1].cumulative}% de la importancia.` : "El modelo usa una sola variable."}`}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Filtrar por efecto">
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
                }
              >
                <div className="p-5">
                  <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
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
                </div>
              </Card>
            </Reveal>
          <div className="flex min-w-0 flex-col gap-6">
            <Reveal className="flex-auto">
              <Card className="h-full" title="Consistencia del score">
                <div className="p-5">
                  <p className="font-display text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {checks.eligiblePositive}
                    <span className="ml-1.5 text-sm font-normal text-gray-400 dark:text-gray-500">
                      de {checks.eligible} de rendimiento alto
                    </span>
                  </p>
                  <div
                    className="relative mt-4 h-4"
                    role="img"
                    aria-label={`${checks.eligiblePositive} de ${checks.eligible} parcelas de rendimiento alto con contribución SHAP neta positiva`}
                  >
                    <span className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-800" />
                    <span
                      className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 transition-[width] duration-500"
                      style={{ width: `${pct(checks.eligiblePositive, checks.eligible)}%`, backgroundColor: "var(--chart-1)" }}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    En {checks.eligiblePositive} de las {checks.eligible} parcelas con índice de rendimiento ≥ 70 la suma de sus
                    principales contribuciones SHAP empuja el rendimiento hacia arriba, como se espera de una parcela
                    de rendimiento alto.
                    {checks.eligible - checks.eligiblePositive > 0 && (
                      <>
                        {" "}
                        Las {checks.eligible - checks.eligiblePositive} restantes son de rendimiento alto aun con un SHAP neto
                        negativo, así que conviene revisarlas manualmente.
                      </>
                    )}
                  </p>
                </div>
              </Card>
            </Reveal>
            <Reveal className="flex-auto">
              <Card
                className="h-full"
                icon={CalendarRange}
                title="Importancia por ventana fenológica"
                description="Cómo se reparte la importancia entre las etapas del ciclo: indica cuándo es más crítico monitorear la parcela."
              >
                <div className="px-5 pb-5">
                  <WindowBreakdown rows={globalImportance} />
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {}
        <Reveal>
          <div className="grid gap-6 sm:grid-cols-2">
            <ShapImage n={3} position="50% 50%" className={`h-48 rounded-xl border sm:h-56 ${LINE}`} />
            <ShapImage n={4} position="50% 50%" className={`h-48 rounded-xl border sm:h-56 ${LINE}`} />
          </div>
        </Reveal>

        {}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-stretch">
          <Reveal className="min-w-0 h-full">
              <Card className="h-full" title="Datos de la validación">
                <dl className={`divide-y px-5 py-1 ${DIVIDE}`}>
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
                <p className={`border-t px-5 py-4 text-xs leading-relaxed text-gray-400 dark:text-gray-500 ${LINE}`}>
                  Cada parcela guarda sus 4 variables con mayor |SHAP|; los totales por parcela se calculan sobre esas 4.
                  {topFeature.feature.toLowerCase().includes("precipitación") &&
                    " Nota: la precipitación está parcialmente confundida con el estado por la resolución de CHIRPS (~5 km)."}
                </p>
              </Card>
            </Reveal>
          <Reveal className="min-w-0 h-full">
              <Card
                className="h-full"
                icon={Layers}
                title="Explicación por parcela"
                description="Contribución SHAP local de las 4 variables con mayor peso en la parcela. Las barras a la derecha suman al rendimiento estimado; a la izquierda restan."
              >
                {selected ? (
                  <>
                    <div className={`border-b p-5 ${LINE}`}>
                      <div className="relative max-w-md">
                        <select
                          value={selected.id}
                          
                          onChange={(e) =>
                            setSelectedId(selectable.find((p) => String(p.id) === e.target.value)?.id ?? null)
                          }
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
                    </div>

                    <JoinedCells bare className="grid-cols-2 xl:grid-cols-4">
                      <SummaryStat
                        label="Rendimiento estimado"
                        value={
                          <>
                            {formatFixed(selected.yieldEstimate, 1)}
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
                        value={`${localNet >= 0 ? "+" : "−"}${formatFixed(Math.abs(localNet), 3)}`}
                      />
                      <SummaryStat label="Variable dominante" value={null} hint={localDrivers[0].feature} />
                    </JoinedCells>

                    <div className="px-5 pb-5">
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
                    </div>
                  </>
                ) : (
                  <p className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    Aún no hay parcelas calculadas en el modo «{MODE_LABEL[predMode]}». Ejecuta el modelo con este modo para explicarlas aquí.
                  </p>
                )}
              </Card>
            </Reveal>
        </div>
      </div>
    </div>
  );
}

export default function ValidacionSHAPPage() {
  return (
    <RequireAnalysis skeleton="shap" title="Validación SHAP" subtitle="Qué variables explican cada predicción." >
      <RequireModelInfo skeleton="shap" withBar>
        <ValidacionSHAPPageContent />
      </RequireModelInfo>
    </RequireAnalysis>
  );
}