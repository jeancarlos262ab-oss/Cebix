import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className=" bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-gray-300 dark:text-gray-600">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/**
 * @param {{data: {model: string, rmse: number, mae: number, r2: number, type: string}[]}} props
 */
export default function AlgorithmComparisonChart({ data }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid vertical={false} stroke="rgba(100,116,139,0.15)" />
          <XAxis
            dataKey="model"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#475467", fontSize: 12, fontWeight: 500 }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#98A2B3", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
          <Bar dataKey="rmse" name="RMSE (ton/ha)" fill="#98A2B3" radius={[4, 4, 0, 0]} barSize={16} />
          <Bar dataKey="mae" name="MAE (ton/ha)" fill="#C08A2E" radius={[4, 4, 0, 0]} barSize={16} />
          <Bar dataKey="r2" name="R²" fill="#3B7A4E" radius={[4, 4, 0, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
