import { memo } from "react";
/**
 * @param {{label: string, value: string, hint?: string, icon?: React.ElementType, tone?: "navy"|"brand"|"ndvi"}} props
 */
const TONE_STYLES = {
  navy: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  brand: "bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400",
  ndvi: "bg-ndvi-400/15 text-ndvi-600 dark:bg-ndvi-500/10 dark:text-ndvi-400",
};

function StatCard({ label, value, hint, icon: Icon, tone = "navy" }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {Icon && (
          <span
            className={`flex h-7 w-7 items-center justify-center ${TONE_STYLES[tone]}`}
          >
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className="font-sora mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

export default memo(StatCard);
