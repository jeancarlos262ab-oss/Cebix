import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import PeriodToggle from "../ui/PeriodToggle";
import {
  balanceLine12m,
  balanceLine30d,
  balanceLine7d,
} from "../../data/chartData";

const PERIODS = ["12 months", "30 days", "7 days"];

const LINE_BY_PERIOD = {
  "12 months": balanceLine12m,
  "30 days": balanceLine30d,
  "7 days": balanceLine7d,
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className=" bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-gray-300 dark:text-gray-600">${Math.round(payload[0].value)}</p>
    </div>
  );
}

export default function BalanceOverTime() {
  const [period, setPeriod] = useState("12 months");
  const data = LINE_BY_PERIOD[period];

  return (
    <section className="bg-white dark:bg-black">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Balance over time</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Compare spending over time.</p>
        </div>
        <PeriodToggle value={period} options={PERIODS} onChange={setPeriod} withMenu />
      </div>

      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="mt-6 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-500)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--accent-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#98A2B3", fontSize: 12 }}
              interval={period === "30 days" ? 3 : 0}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--accent-500)"
              strokeWidth={2.5}
              fill="url(#balanceFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent-500)", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
