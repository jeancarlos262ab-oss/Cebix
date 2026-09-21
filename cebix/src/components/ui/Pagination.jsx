import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../../hooks/usePagination";

/** 1 … 4 5 6 … 20: siempre primera y última página, y la actual con sus vecinas. */
function getPageItems(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const items = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) items.push("gap-start");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < count - 1) items.push("gap-end");
  items.push(count);
  return items;
}

const BASE_BTN =
  "flex h-8 min-w-8 items-center justify-center border px-2 text-sm font-medium transition-colors";
const IDLE_BTN =
  "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-800";
const ACTIVE_BTN = "border-accent-500 bg-accent-500 text-accent-contrast";
const DISABLED_BTN = "cursor-not-allowed opacity-40 hover:bg-white dark:hover:bg-black";

/**
 * Barra de paginación: rango mostrado, tamaño de página y navegación.
 *
 * @param {{
 *   page: number, pageCount: number, pageSize: number, total: number,
 *   onPageChange: (page: number) => void,
 *   onPageSizeChange?: (size: number) => void,
 *   className?: string,
 * }} props
 */
function Pagination({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange, className = "" }) {
  // Con muy pocos elementos no hay nada que paginar.
  if (total <= PAGE_SIZE_OPTIONS[0]) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginación"
      className={["flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Mostrando{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {from}–{to}
          </span>{" "}
          de <span className="font-medium text-gray-800 dark:text-gray-200">{total}</span>
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>Por página</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-200 bg-white py-1 pl-2 pr-1 text-sm font-medium text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-800 dark:bg-black dark:text-gray-200"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={[BASE_BTN, IDLE_BTN, page <= 1 ? DISABLED_BTN : ""].join(" ")}
        >
          <ChevronLeft size={16} />
        </button>

        {/* En pantallas chicas los números no caben: solo "3 / 20". */}
        <span className="px-2 text-sm text-gray-500 dark:text-gray-400 sm:hidden">
          {page} / {pageCount}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {getPageItems(page, pageCount).map((item) =>
            typeof item === "string" ? (
              <span key={item} className="px-1 text-sm text-gray-400 dark:text-gray-500" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={[BASE_BTN, item === page ? ACTIVE_BTN : IDLE_BTN].join(" ")}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          aria-label="Página siguiente"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={[BASE_BTN, IDLE_BTN, page >= pageCount ? DISABLED_BTN : ""].join(" ")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export default memo(Pagination);
