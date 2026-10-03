import { memo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-gray-300 dark:text-gray-600">
        Promedio {row.mean} {unit}
      </p>
      <p className="text-gray-300 dark:text-gray-600">
        Máximo {row.max} {unit}
      </p>
    </div>
  );
}

/**
 * Barras grises del valor máximo detrás de las barras del valor promedio, en color de acento, por categoría.
 *
 * @param {{data: {label: string, max: number, mean: number}[], unit?: string}} props
 */
function MiniBarChart({ data, unit = "ton/ha" }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={-18} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#98A2B3", fontSize: 10 }}
            interval={0}
          />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={false} />
          <Bar isAnimationActive={false} dataKey="max" fill="var(--chart-track)" radius={0} barSize={14} />
          <Bar isAnimationActive={false} dataKey="mean" fill="var(--accent-500)" radius={0} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(MiniBarChart);
