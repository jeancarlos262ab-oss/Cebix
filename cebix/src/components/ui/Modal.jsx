import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { BTN_OUTLINE_SM } from "./buttonStyles";

const SIZES = { sm: "max-w-3xl", md: "max-w-4xl", lg: "max-w-5xl" };

export const MODAL_COLS = "grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2";

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
  aside,
  asideSide = "left",
  splitScroll = false,
  asideFlush = false,
  footer,
  children,
}) {
  const titleId = useId();
  const asidePanel = aside ? (
    <div
      className={`border-gray-100 dark:border-gray-800 ${
        asideFlush ? "relative" : "bg-gray-50 px-5 py-5 sm:px-8 sm:py-6 dark:bg-gray-900/40"
      } ${
        asideSide === "right" ? "border-t md:border-l md:border-t-0" : "border-b md:border-b-0 md:border-r"
      } ${splitScroll ? "md:min-h-0 md:overflow-y-auto" : ""}`}
    >
      {aside}
    </div>
  ) : null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/50 px-3 sm:px-6`}
      onClick={() => !busy && onClose()}
    >
      <Tag
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] sm:max-h-[88vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-black`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-8 sm:py-5 dark:border-gray-800">
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

        {aside ? (
          <div
            className={`min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-2 ${
              splitScroll ? "md:h-[62vh] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden" : ""
            }`}
          >
            {asideSide === "left" && asidePanel}
            <div className={`px-5 py-5 sm:px-8 sm:py-6 ${splitScroll ? "md:min-h-0 md:overflow-y-auto" : ""}`}>{children}</div>
            {asideSide === "right" && asidePanel}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">{children}</div>
        )}

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:px-8 sm:flex-row sm:justify-end dark:border-gray-800">{footer}</div>
        )}
      </Tag>
    </div>
  );
}

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50";

export const MODAL_BTN_CANCEL = `${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-900`;
export const MODAL_BTN_PRIMARY = `${BTN} bg-accent-500 text-accent-contrast hover:bg-accent-600`;
export const MODAL_BTN_DANGER = `${BTN} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500`;

export const MODAL_BTN_SMALL = BTN_OUTLINE_SM;

export function modalInput(error) {
  return [
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500",
    error
      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-accent-500 focus:ring-accent-500 dark:border-gray-700",
  ].join(" ");
}

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