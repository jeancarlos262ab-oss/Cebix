import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white">
      <p className="font-semibold">{row.nFeatures} variables</p>
      <p className="text-gray-300 dark:text-gray-600">R²: {row.r2}</p>
      <p className="text-gray-300 dark:text-gray-600">RMSE: {row.rmse} t/ha</p>
    </div>
  );
}

/**
 * R² de validación según cuántas variables se usan (las mejores por SHAP). `selected` = número elegido.
 * @param {{data: {nFeatures: number, r2: number, rmse: number}[], selected: number}} props
 */
export default function FeatureCountChart({ data, selected }) {
  const best = data.find((d) => d.nFeatures === selected);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.15)" />
          <XAxis
            dataKey="nFeatures"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={data.map((d) => d.nFeatures)}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-neutral)", fontSize: 11 }}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={40}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-neutral)", fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(100,116,139,0.3)" }} />
          <Line isAnimationActive={false} type="monotone" dataKey="r2" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
          {best && <ReferenceDot x={best.nFeatures} y={best.r2} r={6} fill="var(--chart-1)" stroke="#fff" strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
