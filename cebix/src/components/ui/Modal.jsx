import { useEffect, useId } from "react";
import { X } from "lucide-react";

/**
 * Base de todas las ventanas emergentes de la app. Mismo color y borde que el sidebar
 * (blanco / negro, borde fino), con encabezado y pie separados por una línea.
 *
 * @param {{
 *   title: string,
 *   description?: string,          // texto breve bajo el título, en el encabezado
 *   onClose: () => void,
 *   busy?: boolean,                // mientras es true no se cierra con Esc, con el fondo ni con la X
 *   size?: "sm" | "md" | "lg",
 *   as?: "div" | "form",           // "form": el pie queda dentro del formulario (el submit funciona)
 *   onSubmit?: (e: React.FormEvent) => void,
 *   role?: "dialog" | "alertdialog",
 *   zClass?: string,
 *   footer?: React.ReactNode,
 *   children?: React.ReactNode,
 * }} props
 */
const SIZES = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export default function Modal({
  title,
  description,
  onClose,
  busy = false,
  size = "md",
  as: Tag = "div",
  onSubmit,
  role = "dialog",
  zClass = "z-50",
  footer,
  children,
}) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/50 px-4`}
      onClick={() => !busy && onClose()}
    >
      <Tag
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[86vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-black`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">{footer}</div>
        )}
      </Tag>
    </div>
  );
}

// Botones y campos compartidos por las ventanas emergentes.
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50";

export const MODAL_BTN_CANCEL = `${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-900`;
export const MODAL_BTN_PRIMARY = `${BTN} bg-accent-500 text-accent-contrast hover:bg-accent-600`;
export const MODAL_BTN_DANGER = `${BTN} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500`;
/** Botón secundario pequeño (acciones dentro del cuerpo). */
export const MODAL_BTN_SMALL =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900";

/** Clases de un campo de texto; con `error` el borde va en rojo. */
export function modalInput(error) {
  return [
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500",
    error
      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-accent-500 focus:ring-accent-500 dark:border-gray-700",
  ].join(" ");
}

/** Etiqueta de un campo, con el mensaje de error a la derecha. */
export function ModalField({ label, error, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
        {error && <span className="font-normal text-red-500">{error}</span>}
      </span>
      {children}
    </label>
  );
}
