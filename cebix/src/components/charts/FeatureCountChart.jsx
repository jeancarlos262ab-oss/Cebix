import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white">
      <p className="font-semibold">{row.label}</p>
      <p className="text-gray-300 dark:text-gray-600">R²: {row.r2}</p>
      <p className="text-gray-300 dark:text-gray-600">RMSE (ton/ha): {row.rmse}</p>
    </div>
  );
}

/**
 * Mismo estilo que AlgorithmComparisonChart (barras, cuadrícula horizontal, leyenda y tooltip oscuro).
 * R² de validación según cuántas variables se usan; la elegida va resaltada y las demás atenuadas.
 * @param {{data: {nFeatures: number, r2: number, rmse: number}[], selected: number}} props
 */
export default function FeatureCountChart({ data, selected }) {
  const rows = data.map((d) => ({ ...d, label: `${d.nFeatures} variables`, name: String(d.nFeatures) }));
  return (
    <div>
      <ul className="mb-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2" style={{ background: "var(--chart-3)" }} />
          R² por número de variables
        </li>
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.15)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475467", fontSize: 12, fontWeight: 500 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-neutral)", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
            <Bar isAnimationActive={false} dataKey="r2" name="R²" fill="var(--chart-3)" barSize={14}>
              {rows.map((row) => (
                <Cell key={row.name} fill="var(--chart-3)" fillOpacity={row.nFeatures === selected ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
