import { useMemo } from "react";
import { Download } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadCSV } from "../../utils/csv";
import { useParcels } from "../../context/ParcelsContext";
import { yieldHistogram } from "../../utils/parcelStats";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label} ton/ha</p>
      <p className="text-gray-300 dark:text-gray-600">
        {payload[0].value} parcela{payload[0].value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Dibuja marcas verticales, pero recortadas para que solo aparezcan dentro
 * del área pintada bajo la curva (del valor de cada etapa hacia abajo),
 * nunca en la zona blanca por encima de la línea.
 */
function VerticalTicksInsideArea({ xAxisMap, yAxisMap, offset, data }) {
  if (!xAxisMap || !yAxisMap || !offset) return null;
  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis || !yAxis) return null;

  const plotBottom = offset.top + offset.height;

  return (
    <g>
      {data.map((point) => {
        const x = xAxis.scale(point.label);
        const yTop = yAxis.scale(point.value);
        if (x == null || yTop == null) return null;
        return (
          <line
            key={point.label}
            x1={x}
            x2={x}
            y1={yTop}
            y2={plotBottom}
            stroke="var(--accent-500)"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

export default function YieldDistribution() {
  const { parcels } = useParcels();
  const data = useMemo(() => yieldHistogram(parcels), [parcels]);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
            Distribución del rendimiento estimado
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Cuántas parcelas caen en cada rango de rendimiento (ton/ha) según el modelo.
          </p>
        </div>
        <button
          type="button"
          aria-label="Descargar CSV de esta serie"
          title="Descargar CSV de esta serie"
          onClick={() =>
            downloadCSV(
              "cebix-distribucion-rendimiento.csv",
              [
                { key: "label", label: "Rango (ton/ha)" },
                { key: "value", label: "Parcelas" },
              ],
              data
            )
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-accent-600 hover:bg-gray-50 dark:border-gray-700 dark:text-accent-400 dark:hover:bg-gray-800"
        >
          <Download size={16} />
        </button>
      </div>

      <div className="mt-6 h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-500)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--accent-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              horizontal={true}
              stroke="rgba(100,116,139,0.15)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#98A2B3", fontSize: 12 }}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={32}
              tick={{ fill: "#98A2B3", fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--accent-500)", strokeOpacity: 0.3, strokeDasharray: "3 3" }}
            />
            <Area isAnimationActive={false}
              type="monotone"
              dataKey="value"
              stroke="var(--accent-500)"
              strokeWidth={2.5}
              fill="url(#yieldFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent-500)", stroke: "#fff", strokeWidth: 2 }}
            />
            <Customized component={(props) => <VerticalTicksInsideArea {...props} data={data} />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
