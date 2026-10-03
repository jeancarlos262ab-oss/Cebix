import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-gray-300 dark:text-gray-600">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

const SERIES = [
  { key: "rmse", name: "RMSE (ton/ha)", fill: "var(--chart-neutral)" },
  { key: "mae", name: "MAE (ton/ha)", fill: "var(--chart-1)" },
  { key: "r2", name: "R²", fill: "var(--chart-3)" },
];

function ChartLegend() {
  return (
    <ul className="mb-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2" style={{ background: s.fill }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * `highlight` (opcional): nombre del modelo a resaltar; los demás se atenúan.
 * @param {{data: {model: string, rmse: number, mae: number, r2: number, type: string}[], highlight?: string}} props
 */
export default function AlgorithmComparisonChart({ data, highlight }) {
  const dim = (row) => (highlight && row.model !== highlight ? 0.45 : 1);
  return (
    <div>
      <ChartLegend />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.15)" />
            <XAxis
              dataKey="model"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475467", fontSize: 12, fontWeight: 500 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-neutral)", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
            {SERIES.map((s) => (
              <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.name} fill={s.fill} barSize={14}>
                {data.map((row) => (
                  <Cell key={row.model} fill={s.fill} fillOpacity={dim(row)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
