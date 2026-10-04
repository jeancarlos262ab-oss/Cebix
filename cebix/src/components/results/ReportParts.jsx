/**
 * Piezas del "informe de resultado" que comparten Parcela satelital y Predicciones:
 * resumen numérico, escalas finas y contribución por variable. Sin tarjetas ni iconos decorativos.
 */

const MAX_YIELD = 6; // escala fija 0 – 6 ton/ha
const DIRECTION_COLOR = { positivo: "var(--chart-positive)", negativo: "var(--chart-negative)", mixto: "var(--chart-mixed)" };
const SIGN = { positivo: "+", negativo: "−", mixto: "±" };

export const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

export function Label({ children }) {
  return <h3 className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{children}</h3>;
}

/** Escala 0 – 6 ton/ha: línea fina, intervalo sombreado y una marca para la estimación. */
export function RangeBar({ estimate, half }) {
  const low = Math.max(0, estimate - half);
  const high = Math.min(MAX_YIELD, estimate + half);
  const pct = (v) => (Math.min(MAX_YIELD, Math.max(0, v)) / MAX_YIELD) * 100;
  const ticks = Array.from({ length: MAX_YIELD + 1 }, (_, i) => i);
  const shift = (t) => (t === 0 ? "0" : t === MAX_YIELD ? "-100%" : "-50%");

  return (
    <div
      className="mt-7"
      role="img"
      aria-label={`Estimación ${estimate.toFixed(1)} ton/ha, intervalo al 90 % de ${low.toFixed(1)} a ${high.toFixed(1)} ton/ha`}
    >
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300 dark:bg-gray-700" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-accent-500/35" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-accent-600 dark:bg-accent-400" style={{ left: `calc(${pct(estimate)}% - 1px)` }} />
      </div>
      <div className="relative mt-1 h-4 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        {ticks.map((t) => (
          <span key={t} className="absolute" style={{ left: `${pct(t)}%`, transform: `translateX(${shift(t)})` }}>
            {t}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">ton/ha · el sombreado es el intervalo al 90 %</p>
    </div>
  );
}

export function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-6 py-3.5 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/** Contribución SHAP: barras que salen de un eje central (resta a la izquierda, suma a la derecha). */
export function Contributions({ data }) {
  const rows = (data ?? [])
    .map((d) => ({ ...d, magnitude: Math.abs(d.value ?? d.impact ?? 0) }))
    .sort((a, b) => b.magnitude - a.magnitude);
  const max = Math.max(...rows.map((r) => r.magnitude), 0.0001);
  if (!rows.length) return <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No hay contribuciones por variable disponibles.</p>;

  const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(7rem,38%)_3.5rem] items-center gap-x-4";
  return (
    <div className="mt-3">
      <div className={`${COLS} pb-2 text-[11px] text-gray-400 dark:text-gray-500`}>
        <span />
        <span className="flex justify-between">
          <span>← Resta</span>
          <span>Suma →</span>
        </span>
        <span />
      </div>
      <ul className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800/70 dark:border-gray-800/70">
        {rows.map((r) => {
          const half = Math.max(1, (r.magnitude / max) * 50);
          const negative = r.direction === "negativo";
          return (
            <li key={r.feature} className={`${COLS} py-2.5 text-sm`}>
              <span className="min-w-0 leading-snug text-gray-800 dark:text-gray-200">{r.feature}</span>
              <span
                className="relative h-4"
                role="img"
                aria-label={`${r.feature}: ${r.direction ?? "efecto"} de ${r.magnitude.toFixed(2)}`}
              >
                <span className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-700" />
                <span
                  className="absolute top-1/2 h-1.5 -translate-y-1/2"
                  style={{
                    backgroundColor: DIRECTION_COLOR[r.direction] ?? "var(--chart-neutral)",
                    width: `${half}%`,
                    ...(negative ? { right: "50%" } : { left: "50%" }),
                  }}
                />
              </span>
              <span className="text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                {SIGN[r.direction] ?? ""}
                {r.magnitude.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Panel de resumen: rendimiento esperado con su escala a la izquierda y una lista de datos a la derecha
 * (intervalo, score y las filas extra que pase cada pantalla). El semáforo va aparte.
 */
export function SummaryPanel({ yieldEstimate, half, low, high, score, rows = [] }) {
  return (
    <section className="grid overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="p-6">
        <Label>Rendimiento esperado</Label>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-4xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{yieldEstimate.toFixed(1)}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">ton/ha</span>
          <span className="ml-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">± {half.toFixed(1)}</span>
        </p>
        <RangeBar estimate={yieldEstimate} half={half} />
      </div>

      <dl className="divide-y divide-gray-100 border-t border-gray-200 dark:divide-gray-800/70 dark:border-gray-800 lg:border-l lg:border-t-0">
        <Row label="Intervalo al 90 %">
          {low.toFixed(1)} – {high.toFixed(1)} ton/ha
        </Row>
        <Row label="Score de elegibilidad">{score} / 100</Row>
        {rows.map((r) => (
          <Row key={r.label} label={r.label}>
            {r.value}
          </Row>
        ))}
      </dl>
    </section>
  );
}
