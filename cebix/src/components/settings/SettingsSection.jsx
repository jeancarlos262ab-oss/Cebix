/**
 * Tarjeta contenedora estándar para cada bloque de la página de Ajustes.
 *
 * @param {{icon?: React.ElementType, title: string, description?: string, children: React.ReactNode}} props
 */
export default function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-3 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
      <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </section>
  );
}
