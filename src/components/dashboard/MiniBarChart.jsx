import { memo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className=" bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-gray-300 dark:text-gray-600">{payload[0].value} GDD observados</p>
    </div>
  );
}

/**
 * Barras grises de GDD esperado detrás de las barras doradas de GDD observado,
 * por etapa del ciclo fenológico.
 *
 * @param {{data: {month: string, budget: number, spent: number}[]}} props
 */
function MiniBarChart({ data }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={-18} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#98A2B3", fontSize: 10 }}
            interval={0}
          />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Bar dataKey="budget" fill="#EAECF0" radius={[4, 4, 4, 4]} barSize={14} />
          <Bar dataKey="spent" fill="#C08A2E" radius={[4, 4, 4, 4]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(MiniBarChart);
