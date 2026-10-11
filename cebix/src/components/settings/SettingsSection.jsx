/**
 * Tarjeta contenedora estándar para cada bloque de Ajustes y Perfil: encabezado con título y
 * descripción, línea divisoria y filas separadas por líneas finas (cada hijo directo es una fila).
 *
 * @param {{icon?: React.ElementType, title: string, description?: string, children: React.ReactNode}} props
 */
export default function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 last:mb-0 dark:border-gray-800">
      <header className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        {Icon && <Icon size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500" />}
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </header>
      <div className="divide-y divide-gray-200 px-5 dark:divide-gray-800">{children}</div>
    </section>
  );
}
