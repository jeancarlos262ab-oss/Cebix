import { memo } from "react";
/**
 * Switch on/off accesible, estilo iOS, coherente con la paleta de CEBIX.
 *
 * @param {{checked: boolean, onChange: (v: boolean) => void, label?: string, description?: string}} props
 */
function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        {label && (
          <span className="block text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </span>
        )}
        {description && (
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 shrink-0 border transition-colors focus:outline-none focus:ring-2 focus:ring-accent-100",
          checked
            ? "border-accent-500 bg-accent-500"
            : "border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-800",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4.5 w-4.5 bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
          style={{ height: "18px", width: "18px" }}
        />
      </button>
    </label>
  );
}

export default memo(Toggle);
