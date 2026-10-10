import { GEE_FEATURES, SOURCES } from "../../data/earthEngine";
import { WindowChip } from "./SourceChip";
import { formatNumber } from "../../utils/intl";

const fmt = (value, digits) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "—"
    : formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Las 10 variables calculadas en vivo, con su fuente, ventana y valor. */
export default function FeaturesTable({ features }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <th className="px-4 py-2.5 font-medium">Variable</th>
            <th className="px-4 py-2.5 font-medium">Fuente</th>
            <th className="px-4 py-2.5 font-medium">Ventana</th>
            <th className="px-4 py-2.5 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {GEE_FEATURES.map((f) => (
            <tr key={f.key} className="border-b border-gray-100 last:border-0 dark:border-gray-800/70">
              <td className="px-4 py-3">
                <p className="text-gray-900 dark:text-gray-100">{f.label}</p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{f.method}</p>
                {f.hint && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{f.hint}</p>}
              </td>
              <td className="px-4 py-3">
                <span title={SOURCES[f.source].dataset} className="text-xs text-gray-600 dark:text-gray-300">
                  {SOURCES[f.source].label}
                </span>
              </td>
              <td className="px-4 py-3">
                <WindowChip window={f.window} />
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt(features?.[f.key], f.digits)}
                </span>
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{f.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
