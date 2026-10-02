const DIRECTION_COLOR = {
  positivo: "var(--chart-positive)",
  negativo: "var(--chart-negative)",
  mixto: "var(--chart-mixed)",
};

const DIRECTION_LABEL = {
  positivo: "Suma al rendimiento",
  negativo: "Resta al rendimiento",
  mixto: "Efecto mixto",
};

const SIGN = { positivo: "+", negativo: "−", mixto: "±" };

/**
 * Contribución SHAP por variable, como lista con barras proporcionales.
 * Se hace en HTML (no en recharts) para que los nombres largos se lean completos
 * en vez de cortarse en el eje. `height` se acepta por compatibilidad pero ya no
 * se usa: la lista toma el alto que necesite.
 *
 * @param {{data: {feature: string, value?: number, impact?: number, direction: string}[], height?: number}} props
 */
export default function FeatureImportanceChart({ data }) {
  const rows = data.map((d) => ({ ...d, magnitude: Math.abs(d.value ?? d.impact) }));
  const max = Math.max(...rows.map((r) => r.magnitude), 0.0001);
  const present = [...new Set(rows.map((r) => r.direction))];

  return (
    <div className="w-full">
      <ul className="space-y-4">
        {rows.map((row) => {
          const color = DIRECTION_COLOR[row.direction] ?? "var(--chart-neutral)";
          const pct = Math.max(1.5, (row.magnitude / max) * 100);
          return (
            <li key={row.feature}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm leading-snug text-gray-800 dark:text-gray-200">
                  {row.feature}
                </span>
                <span className="font-display shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {SIGN[row.direction] ?? ""}
                  {row.magnitude.toFixed(2)}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                role="img"
                aria-label={`${row.feature}: impacto ${row.direction} de ${row.magnitude.toFixed(2)}`}
              >
                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 pt-3">
        {present.map((dir) => (
          <li key={dir} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span
              className="h-2.5 w-2.5 shrink-0"
              style={{ backgroundColor: DIRECTION_COLOR[dir] ?? "var(--chart-neutral)" }}
            />
            {DIRECTION_LABEL[dir] ?? dir}
          </li>
        ))}
      </ul>
    </div>
  );
}
