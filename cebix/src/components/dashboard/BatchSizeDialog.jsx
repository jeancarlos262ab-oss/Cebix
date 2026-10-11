import { useState } from "react";
import { Clock } from "lucide-react";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_PRIMARY, modalInput } from "../ui/Modal";

// Cada parcela se calcula con imágenes satelitales y el backend procesa una a la vez.
const SECONDS_PER_PARCEL = [30, 90];
const LONG_RUN_SECONDS = 20 * 60; // a partir de aquí se avisa que hay que dejar la pestaña abierta

function formatDuration(seconds) {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Pregunta cuántas parcelas calcular cuando un archivo trae muchas, avisando cuánto tardará.
 *
 * @param {{ total: number, omitted?: number, fileName?: string, onConfirm: (count: number) => void, onClose: () => void }} props
 */
export default function BatchSizeDialog({ total, omitted = 0, fileName, onConfirm, onClose }) {
  const [count, setCount] = useState(Math.min(10, total));

  const valid = Number.isInteger(count) && count >= 1 && count <= total;
  const [minSec, maxSec] = SECONDS_PER_PARCEL.map((s) => s * (valid ? count : 0));
  const long = valid && maxSec >= LONG_RUN_SECONDS;
  const presets = [...new Set([1, 10, 25, 50, total].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);

  return (
    <Modal
      title={total === 1 ? "El archivo trae 1 parcela" : `El archivo trae ${total} parcelas`}
      description={`${fileName ? `«${fileName}». ` : ""}Cada parcela se calcula con imágenes de satélite y tarda entre ${SECONDS_PER_PARCEL[0]} y ${SECONDS_PER_PARCEL[1]} s. Se calculan una por una.${omitted > 0 ? ` (${omitted} más no se pueden calcular y se omiten).` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={MODAL_BTN_CANCEL}>
            Cancelar
          </button>
          <button type="button" disabled={!valid} onClick={() => onConfirm(count)} className={MODAL_BTN_PRIMARY}>
            {valid ? `Calcular ${count === 1 ? "1 parcela" : `${count} parcelas`}` : "Calcular"}
          </button>
        </>
      }
    >
      <label htmlFor="batch-count" className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        ¿Cuántas parcelas quieres calcular?
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id="batch-count"
          type="number"
          min={1}
          max={total}
          step={1}
          value={Number.isNaN(count) ? "" : count}
          onChange={(e) => setCount(e.target.value === "" ? NaN : Number(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && valid && onConfirm(count)}
          autoFocus
          className={`${modalInput(!valid)} w-24`}
        />
        {presets.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              count === n
                ? "border-accent-500 text-accent-700 dark:text-accent-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            }`}
          >
            {n === total && total > 1 ? `Todas (${total})` : n}
          </button>
        ))}
      </div>
      {!valid && <p className="mt-2 text-xs text-red-600 dark:text-red-400">Escribe un número entre 1 y {total}.</p>}

      {valid && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
            long
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              : "border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-300"
          }`}
        >
          <Clock size={14} className="mt-0.5 shrink-0" />
          <p>
            Tardará aproximadamente <strong>{formatDuration(minSec)} a {formatDuration(maxSec)}</strong>.
            {long
              ? " Es mucho tiempo: deja esta pestaña abierta y el equipo encendido. Cada parcela se guarda en cuanto termina, así que si cancelas o se corta, lo ya calculado se conserva."
              : " Cada parcela se guarda en cuanto termina."}
          </p>
        </div>
      )}
    </Modal>
  );
}
