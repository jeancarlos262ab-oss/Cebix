import { Menu } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import { useSidebar } from "../../context/SidebarContext";

/**
 * @param {{title: string, subtitle?: string, actions?: React.ReactNode, hideSearch?: boolean}} props
 */
export default function TopBar({ title, subtitle, actions, hideSearch = false }) {
  const { toggle } = useSidebar();

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menú"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-sora text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {!hideSearch && <GlobalSearch />}
      </div>
    </header>
  );
}
