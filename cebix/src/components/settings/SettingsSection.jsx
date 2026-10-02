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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-accent-600 dark:bg-gray-800 dark:text-accent-400">
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
