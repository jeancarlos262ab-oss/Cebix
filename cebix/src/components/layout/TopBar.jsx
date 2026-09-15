import GlobalSearch from "./GlobalSearch";

/**
 * @param {{title: string, subtitle?: string, actions?: React.ReactNode, hideSearch?: boolean}} props
 */
export default function TopBar({ title, subtitle, actions, hideSearch = false }) {
  return (
    <header className="flex items-start justify-between gap-6 px-8 pt-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        {!hideSearch && <GlobalSearch />}
      </div>
    </header>
  );
}
