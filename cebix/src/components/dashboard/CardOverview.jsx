import { useState } from "react";
import CreditCardStack from "./CreditCardStack";
import MiniBarChart from "./MiniBarChart";
import PeriodToggle from "../ui/PeriodToggle";
import {
  spendingBars12m,
  spendingBars30d,
  spendingBars7d,
} from "../../data/chartData";

const TABS = ["Overview", "Budget", "Spending", "Rewards"];
const PERIODS = ["12 months", "30 days", "7 days"];

const BARS_BY_PERIOD = {
  "12 months": spendingBars12m,
  "30 days": spendingBars30d,
  "7 days": spendingBars7d,
};

const SUMMARY_ROWS = [
  { label: "Current balance", value: "$1,440.40" },
  { label: "Current limit", value: "$15,000.00" },
  { label: "Budget this month", value: "$2,400.00" },
];

export default function CardOverview() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [period, setPeriod] = useState("12 months");

  return (
    <section className="bg-white dark:bg-black">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overview</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Manage and track your card spending.
      </p>
      <div className="mt-4 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <CreditCardStack />

      <div className="mt-2 flex gap-5 border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "-mb-px border-b-2 pb-2.5 transition-colors",
              activeTab === tab
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      <dl className="mt-4 space-y-3">
        {SUMMARY_ROWS.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Balances over time</h3>
        <div className="mt-3">
          <PeriodToggle value={period} options={PERIODS} onChange={setPeriod} />
        </div>
        <div className="mt-4">
          <MiniBarChart data={BARS_BY_PERIOD[period]} />
        </div>
      </div>
    </section>
  );
}
