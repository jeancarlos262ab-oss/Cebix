import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DIRECTION_COLOR = {
  positivo: "var(--accent-500)",
  negativo: "#C0362E",
  mixto: "var(--accent-400)",
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className=" bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{row.feature}</p>
      <p className="text-gray-300 dark:text-gray-600">
        Impacto {row.direction}: {Math.abs(row.value ?? row.impact).toFixed(2)}
      </p>
    </div>
  );
}

/**
 * @param {{data: {feature: string, value?: number, impact?: number, direction: string}[], height?: number}} props
 */
export default function FeatureImportanceChart({ data, height = 260 }) {
  const rows = data.map((d) => ({ ...d, magnitude: Math.abs(d.value ?? d.impact) }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="feature"
            width={190}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#475467", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
          <Bar dataKey="magnitude" radius={[0, 6, 6, 0]} barSize={14}>
            {rows.map((row, i) => (
              <Cell key={i} fill={DIRECTION_COLOR[row.direction] ?? "#98A2B3"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
