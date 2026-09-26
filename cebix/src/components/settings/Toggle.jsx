import { memo } from "react";
/**
 * Switch on/off accesible, con el patrón "default" de Tailwind
 * (input checkbox oculto + peer + pseudo-elemento after: para la bolita),
 * así el track y la bolita siempre quedan alineados sin desbordarse.
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

      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
          className="peer sr-only"
        />
        <span
          className="h-6 w-11 rounded-full bg-gray-200 transition-colors duration-200 ease-in-out
            after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full
            after:bg-white after:shadow after:transition-transform after:duration-200 after:ease-in-out after:content-['']
            peer-checked:bg-accent-500 peer-checked:after:translate-x-full peer-checked:after:bg-accent-contrast
            peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500
            dark:bg-gray-700"
        />
      </span>
    </label>
  );
}

export default memo(Toggle);
