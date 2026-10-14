import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_DANGER } from "./Modal";

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
    <Modal
      title={title}
      size="sm"
      role="alertdialog"
      busy={busy}
      aside={
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Acción irreversible</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Revisa con cuidado antes de continuar: no es posible deshacer este cambio.
            </p>
          </div>
        </div>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={MODAL_BTN_CANCEL}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={busy} className={MODAL_BTN_DANGER}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}
