import { GEE_FEATURES, VALIDATION_TOLERANCE } from "../../data/earthEngine";

const toleranceOf = (key) => VALIDATION_TOLERANCE[key] ?? VALIDATION_TOLERANCE.default;

function diffPct(official, gee) {
  if (!official) return null;
  return ((gee - official) / Math.abs(official)) * 100;
}

/**
 * Matriz de diferencia porcentual entre el cálculo en vivo (GEE) y el dataset oficial:
 * una fila por variable, una columna por parcela. Verde = dentro de tolerancia.
 */
export default function ValidationTable({ rows }) {
  const cells = rows.flatMap((r) =>
    GEE_FEATURES.map((f) => {
      const d = diffPct(r.official[f.key], r.gee[f.key]);
      return { key: f.key, d, ok: d !== null && Math.abs(d) <= toleranceOf(f.key) };
    })
  );
  const okCount = cells.filter((c) => c.ok).length;
  const worst = cells.reduce((m, c) => (c.d !== null && Math.abs(c.d) > Math.abs(m) ? c.d : m), 0);

  return (
    <div>
      <dl className="mb-5 grid grid-cols-3 gap-4 sm:max-w-xl">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Parcelas comparadas</dt>
          <dd className="font-display mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{rows.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Dentro de tolerancia</dt>
          <dd className="font-display mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round((okCount / cells.length) * 100)}%
            <span className="ml-1 text-xs font-medium text-gray-400">
              ({okCount}/{cells.length})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Mayor desviación</dt>
          <dd className="font-display mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
            {worst > 0 ? "+" : ""}
            {worst.toFixed(1)}%
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Variable</th>
              <th className="px-2 py-3 text-right font-medium">Tolerancia</th>
              {rows.map((r) => (
                <th key={r.id} className="px-3 py-3 text-right font-medium">
                  {r.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GEE_FEATURES.map((f) => (
              <tr key={f.key} className="border-b border-gray-100 last:border-0 dark:border-gray-900">
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{f.label}</td>
                <td className="px-2 py-2.5 text-right text-xs text-gray-400 dark:text-gray-500">±{toleranceOf(f.key)}%</td>
                {rows.map((r) => {
                  const d = diffPct(r.official[f.key], r.gee[f.key]);
                  const ok = d !== null && Math.abs(d) <= toleranceOf(f.key);
                  return (
                    <td key={r.id} className="px-3 py-2.5 text-right">
                      <span
                        title={`Oficial ${r.official[f.key]} · GEE ${r.gee[f.key]}`}
                        className={`inline-block min-w-[3.75rem] rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          ok
                            ? "bg-ndvi-400/15 text-ndvi-700 dark:bg-ndvi-500/15 dark:text-ndvi-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
