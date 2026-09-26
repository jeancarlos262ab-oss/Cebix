import { memo, useEffect, useRef, useState } from "react";
import { MoreVertical, Download } from "lucide-react";

/**
 * Segmented control used to switch a chart's time range, with an optional
 * "..." menu that exposes real per-chart actions (e.g. download the series
 * currently shown as CSV).
 *
 * @param {{value: string, options: string[], onChange: (v: string) => void, withMenu?: boolean, onMenuAction?: () => void, menuLabel?: string}} props
 */
function PeriodToggle({ value, options, onChange, withMenu = false, onMenuAction, menuLabel = "Descargar CSV" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-0.5 text-xs font-medium">
        {options.map((option) => {
          const isActive = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                " px-2.5 py-1.5 transition-colors",
                isActive
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
      {withMenu && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Más opciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className=" p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 border border-gray-200 bg-white py-1 shadow-card dark:border-gray-800 dark:bg-gray-900"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onMenuAction?.();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Download size={13} />
                {menuLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(PeriodToggle);
