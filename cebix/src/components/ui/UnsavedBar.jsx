import { useEffect, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useParcels } from "../../context/ParcelsContext";
import { toast } from "../../services/toast";
import Modal, { MODAL_BTN_CANCEL, MODAL_BTN_DANGER, MODAL_BTN_PRIMARY } from "./Modal";

/**
 * Ventana emergente global para guardar los resultados de la corrida del modelo. Se abre sola cuando hay una
 * corrida SIN guardar. Nada se guarda solo: únicamente al pulsar "Guardar corrida". Cerrarla no borra nada: la
 * corrida sigue como borrador y queda un aviso discreto para volver a abrirla.
 */
export default function UnsavedBar() {
  const { analysisDirty, analysisMeta, saveAnalysisDraft, discardAnalysisDraft } = useParcels();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const wasDirty = useRef(false);

  // Se abre al aparecer un borrador nuevo y se cierra sola cuando ya no hay nada pendiente.
  useEffect(() => {
    if (analysisDirty && !wasDirty.current) setOpen(true);
    if (!analysisDirty) {
      setOpen(false);
      setConfirmDiscard(false);
    }
    wasDirty.current = analysisDirty;
  }, [analysisDirty]);

  if (!analysisDirty) return null;

  const count = analysisMeta?.count ?? 0;
  const parcelsText = count ? `${count} parcela${count === 1 ? "" : "s"}` : "la corrida";

  async function handleSave() {
    setSaving(true);
    const { error } = await saveAnalysisDraft();
    setSaving(false);
    if (error) toast.error("No se pudo guardar la corrida. Sigue como borrador; inténtalo de nuevo.", { id: "save-analysis" });
    else toast.success("Corrida guardada.", { id: "save-analysis" });
  }

  function handleDiscard() {
    discardAnalysisDraft();
    setOpen(false);
    setConfirmDiscard(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-gray-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        Resultados sin guardar · {parcelsText} · Revisar y guardar
      </button>
    );
  }

  return (
    <Modal
      title="Resultados sin guardar"
      description={
        analysisMeta?.fileName
          ? `Corrida de '${analysisMeta.fileName}'. Si recargas o cierras la pestaña sin guardar, se pierden.`
          : "Si recargas o cierras la pestaña sin guardar, se pierden."
      }
      size="sm"
      onClose={() => setOpen(false)}
      busy={saving}
      footer={
        confirmDiscard ? (
          <>
            <button type="button" onClick={() => setConfirmDiscard(false)} disabled={saving} className={MODAL_BTN_CANCEL}>
              Volver
            </button>
            <button type="button" onClick={handleDiscard} disabled={saving} className={MODAL_BTN_DANGER}>
              Descartar corrida
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirmDiscard(true)} disabled={saving} className={MODAL_BTN_CANCEL}>
              Descartar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className={MODAL_BTN_PRIMARY}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} strokeWidth={1.75} />}
              Guardar corrida
            </button>
          </>
        )
      }
    >
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {confirmDiscard
          ? `Se descartará ${parcelsText} de esta corrida y el dashboard volverá a la última corrida guardada.`
          : `La corrida trae ${parcelsText} procesada${count === 1 ? "" : "s"} por el modelo. Ya puedes verlas en el dashboard; pulsa Guardar corrida para conservarlas.`}
      </p>
    </Modal>
  );
}
