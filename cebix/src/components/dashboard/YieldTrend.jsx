import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import PeriodToggle from "../ui/PeriodToggle";
import { downloadCSV } from "../../utils/csv";
import {
  yieldTrendFull,
  yieldTrend60d,
  yieldTrend30d,
} from "../../data/chartData";

const PERIODS = ["Ciclo completo", "60 días", "30 días"];

const LINE_BY_PERIOD = {
  "Ciclo completo": yieldTrendFull,
  "60 días": yieldTrend60d,
  "30 días": yieldTrend30d,
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className=" bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-gray-300 dark:text-gray-600">{payload[0].value.toFixed(1)} ton/ha</p>
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
        const x = xAxis.scale(point.month);
        const yTop = yAxis.scale(point.value);
        if (x == null || yTop == null) return null;
        return (
          <line
            key={point.month}
            x1={x}
            x2={x}
            y1={yTop}
            y2={plotBottom}
            stroke="#3B7A4E"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

export default function YieldTrend() {
  const [period, setPeriod] = useState("Ciclo completo");
  const data = LINE_BY_PERIOD[period];

  return (
    <section className="bg-white dark:bg-black">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Rendimiento estimado en el tiempo
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            NDVI/EVI y rendimiento proyectado por etapa del ciclo.
          </p>
        </div>
        <PeriodToggle
          value={period}
          options={PERIODS}
          onChange={setPeriod}
          withMenu
          menuLabel="Descargar CSV de esta serie"
          onMenuAction={() =>
            downloadCSV(
              `cebix-rendimiento-${period.toLowerCase().replace(/\s+/g, "-")}.csv`,
              [
                { key: "month", label: "Mes" },
                { key: "value", label: "Rendimiento estimado (ton/ha)" },
              ],
              data
            )
          }
        />
      </div>

      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="mt-6 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B7A4E" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#3B7A4E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              horizontal={true}
              stroke="rgba(100,116,139,0.15)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#98A2B3", fontSize: 12 }}
              interval={0}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B7A4E"
              strokeWidth={2.5}
              fill="url(#yieldFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#3B7A4E", stroke: "#fff", strokeWidth: 2 }}
            />
            <Customized component={(props) => <VerticalTicksInsideArea {...props} data={data} />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
