import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

/**
 * Diálogo de confirmación para acciones que no se pueden deshacer.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   onConfirm: () => Promise<{error?: Error|null}|void>|void,
 *   onClose: () => void,
 * }} props
 * `onConfirm` puede devolver `{ error }`: si hay error, el diálogo se queda abierto y lo muestra.
 */
export default function ConfirmDialog({ title, description, confirmLabel = "Eliminar", onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result?.error) {
        setError(result.error.message || "No se pudo completar la acción.");
        setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err?.message || "No se pudo completar la acción.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id="confirm-title" className="font-display text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
