import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, MODAL_BTN_DANGER } from "../ui/Modal";
import { formatFixed } from "../../utils/intl";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function StagedParcelsDialog({ staged, saving, onRename, onCommitName, onSave, onDiscard, onClose }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const count = staged.length;

  return (
    <Modal
      title={plural(count, "parcela sin guardar", "parcelas sin guardar")}
      description="Revisa los nombres antes de guardar; puedes cambiar el de cada parcela. Si cierras esta ventana, las parcelas siguen aquí sin guardar."
      onClose={onClose}
      busy={saving}
      footer={
        confirmDiscard ? (
          <>
            <button type="button" onClick={() => setConfirmDiscard(false)} disabled={saving} className={MODAL_BTN_CANCEL}>
              Volver
            </button>
            <button type="button" onClick={onDiscard} disabled={saving} className={MODAL_BTN_DANGER}>
              Descartar {plural(count, "parcela", "parcelas")}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirmDiscard(true)} disabled={saving} className={MODAL_BTN_CANCEL}>
              Descartar
            </button>
            <button type="button" onClick={onSave} disabled={saving} className={MODAL_BTN_PRIMARY}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} strokeWidth={1.75} />}
              Guardar {count}
            </button>
          </>
        )
      }
    >
      {confirmDiscard && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Se perderán {plural(count, "parcela calculada", "parcelas calculadas")}. Calcularlas de nuevo tarda entre 30 y 90 s cada una.
        </p>
      )}

      <div className="hidden grid-cols-[minmax(0,1fr)_110px_90px_100px] gap-3 px-1 pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 sm:grid">
        <span>Nombre</span>
        <span>Región</span>
        <span className="text-right">Área</span>
        <span className="text-right">Rendimiento</span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {staged.map((f, i) => {
          const yieldValue = Number(f.yieldEstimate);
          return (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,1fr)_110px_90px_100px]">
              <input
                type="text"
                value={f.name}
                maxLength={80}
                disabled={saving}
                onChange={(e) => onRename(i, e.target.value)}
                onBlur={() => onCommitName(i)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                aria-label={`Nombre de la parcela ${f._origName ?? f.name}`}
                className="min-w-0 rounded-md bg-transparent px-2 py-1.5 text-sm text-gray-900 hover:bg-gray-100 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-accent-500 disabled:opacity-60 dark:text-gray-100 dark:hover:bg-gray-900 dark:focus:bg-black"
              />
              <span className="text-right text-sm tabular-nums text-gray-700 dark:text-gray-200 sm:order-last">
                {Number.isFinite(yieldValue) ? `${formatFixed(yieldValue, 1)} t/ha` : "—"}
              </span>
              <span className="hidden text-sm text-gray-600 dark:text-gray-400 sm:block">{f.region || "—"}</span>
              <span className="hidden text-right text-sm tabular-nums text-gray-600 dark:text-gray-400 sm:block">{f.area || "—"}</span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}