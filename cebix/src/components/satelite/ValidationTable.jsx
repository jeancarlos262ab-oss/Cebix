import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { SAT_FEATURES, VALIDATION_TOLERANCE } from "../../data/satelite";

const toleranceOf = (key) => VALIDATION_TOLERANCE[key] ?? VALIDATION_TOLERANCE.default;

function diffPct(official, live) {
  if (!official || live === null || live === undefined) return null;
  return ((live - official) / Math.abs(official)) * 100;
}

const fmtDiff = (d) => (d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`);
const fmtValue = (v, digits) => (v === null || v === undefined ? "—" : Number(v).toFixed(digits));

function Stat({ label, children }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-bold text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.key
              ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
              : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Comparación entre el cálculo en vivo y el dataset oficial. Dos vistas:
 *  - «Diferencia»: matriz compacta, una fila por variable y una columna por parcela (% de diferencia).
 *  - «Valores»: por parcela, tres columnas separadas (oficial · en vivo · diferencia) para compararlas lado a lado.
 */
export default function ValidationTable({ rows, onClear, onDownload }) {
  const [mode, setMode] = useState("diff");

  const cells = rows.flatMap((r) =>
    SAT_FEATURES.map((f) => {
      const d = diffPct(r.official[f.key], r.live[f.key]);
      return { d, ok: d !== null && Math.abs(d) <= toleranceOf(f.key) };
    })
  );
  const okCount = cells.filter((c) => c.ok).length;
  const worst = cells.reduce((m, c) => (c.d !== null && Math.abs(c.d) > Math.abs(m) ? c.d : m), 0);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 divide-x divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        <Stat label="Parcelas comparadas">{rows.length}</Stat>
        <Stat label="Dentro de tolerancia">
          <span className="text-accent-600 dark:text-accent-400">{cells.length ? Math.round((okCount / cells.length) * 100) : 0}%</span>
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            ({okCount}/{cells.length})
          </span>
        </Stat>
        <Stat label="Mayor desviación">{fmtDiff(worst)}</Stat>
      </dl>

      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">Comparación por variable</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Resaltado en rojo lo que sale de la tolerancia.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { key: "diff", label: "Diferencia" },
                { key: "values", label: "Valores" },
              ]}
            />
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Download size={13} strokeWidth={1.75} className="text-gray-400" /> JSON
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Trash2 size={13} strokeWidth={1.75} className="text-gray-400" /> Limpiar
            </button>
          </div>
        </header>

        <div className="overflow-x-auto">
          {mode === "diff" ? (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-5 py-3.5 font-medium">Variable</th>
                  <th className="px-4 py-3.5 text-right font-medium">Tolerancia</th>
                  {rows.map((r) => (
                    <th key={r.id} className="px-5 py-3.5 text-right font-medium">
                      {r.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                {SAT_FEATURES.map((f) => (
                  <tr key={f.key}>
                    <td className="px-5 py-3.5 text-gray-900 dark:text-gray-100">{f.label}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-gray-400 dark:text-gray-500">±{toleranceOf(f.key)}%</td>
                    {rows.map((r) => {
                      const d = diffPct(r.official[f.key], r.live[f.key]);
                      const ok = d !== null && Math.abs(d) <= toleranceOf(f.key);
                      return (
                        <td key={r.id} className="px-5 py-3.5 text-right">
                          <span
                            title={`Oficial ${r.official[f.key]} · En vivo ${r.live[f.key]}`}
                            className={`inline-block min-w-[4rem] rounded px-2 py-0.5 text-xs tabular-nums ${
                              ok ? "text-gray-600 dark:text-gray-300" : "bg-red-500/10 font-semibold text-red-700 dark:text-red-400"
                            }`}
                          >
                            {fmtDiff(d)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm" style={{ minWidth: 320 + rows.length * 270 }}>
              <thead>
                <tr className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th rowSpan={2} className="px-5 py-3.5 align-bottom font-medium">
                    Variable
                  </th>
                  {rows.map((r) => (
                    <th
                      key={r.id}
                      colSpan={3}
                      className="border-l border-gray-200 px-4 pb-1 pt-3.5 text-center font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100"
                    >
                      {r.id}
                      {r.estado && <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">{r.estado}</span>}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  {rows.map((r) => (
                    <FragmentHead key={r.id} />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                {SAT_FEATURES.map((f) => (
                  <tr key={f.key}>
                    <td className="px-5 py-3.5 text-gray-900 dark:text-gray-100">
                      {f.label}
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{f.unit}</span>
                    </td>
                    {rows.map((r) => {
                      const d = diffPct(r.official[f.key], r.live[f.key]);
                      const ok = d !== null && Math.abs(d) <= toleranceOf(f.key);
                      return (
                        <ValueCells
                          key={r.id}
                          official={fmtValue(r.official[f.key], f.digits)}
                          live={fmtValue(r.live[f.key], f.digits)}
                          diff={fmtDiff(d)}
                          ok={ok}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function FragmentHead() {
  const base = "px-4 py-2 text-right font-medium";
  return (
    <>
      <th className={`${base} border-l border-gray-200 dark:border-gray-800`}>Oficial</th>
      <th className={base}>En vivo</th>
      <th className={base}>Dif.</th>
    </>
  );
}

function ValueCells({ official, live, diff, ok }) {
  return (
    <>
      <td className="border-l border-gray-200 px-4 py-3.5 text-right tabular-nums text-gray-600 dark:border-gray-800 dark:text-gray-300">{official}</td>
      <td className="px-4 py-3.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{live}</td>
      <td className="px-4 py-3.5 text-right">
        <span
          className={`inline-block min-w-[3.75rem] rounded px-2 py-0.5 text-xs tabular-nums ${
            ok ? "text-gray-500 dark:text-gray-400" : "bg-red-500/10 font-semibold text-red-700 dark:text-red-400"
          }`}
        >
          {diff}
        </span>
      </td>
    </>
  );
}
