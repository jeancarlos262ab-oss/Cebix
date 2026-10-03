import { memo } from "react";
/**
 * @param {{label: string, value: string, hint?: string, icon?: React.ElementType, tone?: "navy"|"brand"|"ndvi", cornerIcon?: boolean}} props
 *
 * `cornerIcon`: en vez del círculo junto a la etiqueta, dibuja el icono grande,
 * inclinado y de color acento sólido en la esquina inferior derecha de la tarjeta, saliendo del
 * borde. El contenedor de la tarjeta debe ser `relative overflow-hidden`.
 */
const TONE_STYLES = {
  navy: "bg-gray-100 text-accent-600 dark:bg-gray-800 dark:text-accent-400",
  brand: "bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400",
  ndvi: "bg-ndvi-400/15 text-ndvi-600 dark:bg-ndvi-500/10 dark:text-ndvi-400",
};

function StatCard({ label, value, hint, icon: Icon, tone = "navy", cornerIcon = false }) {
  if (cornerIcon && Icon) {
    return (
      <div>
        <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-display relative z-10 mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </p>
        {hint && (
          <p className="relative z-10 mt-1 pr-12 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
        )}
        {/* Mismo acento sólido en todas las tarjetas, sin importar el `tone`. */}
        <Icon
          aria-hidden="true"
          size={64}
          strokeWidth={1.75}
          className="pointer-events-none absolute -bottom-5 -right-2 -rotate-12 text-accent-600 dark:text-accent-400"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {Icon && (
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${TONE_STYLES[tone]}`}
          >
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className="font-display mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

export default memo(StatCard);
