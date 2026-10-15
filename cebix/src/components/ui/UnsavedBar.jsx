import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useParcels } from "../../context/ParcelsContext";
import { toast } from "../../services/toast";

/**
 * Barra flotante global: aparece mientras haya una corrida del modelo SIN guardar.
 * Nada de la corrida se guarda solo; únicamente al pulsar "Guardar corrida".
 */
export default function UnsavedBar() {
  const { analysisDirty, analysisMeta, saveAnalysisDraft, discardAnalysisDraft } = useParcels();
  const [saving, setSaving] = useState(false);
  if (!analysisDirty) return null;

  const count = analysisMeta?.count ?? 0;

  async function handleSave() {
    setSaving(true);
    const { error } = await saveAnalysisDraft();
    setSaving(false);
    if (error) toast.error("No se pudo guardar la corrida. Sigue como borrador; inténtalo de nuevo.", { id: "save-analysis" });
    else toast.success("Corrida guardada.", { id: "save-analysis" });
  }

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/60 bg-white px-4 py-3 shadow-lg dark:bg-gray-900"
    >
      <p className="text-xs leading-snug text-gray-700 dark:text-gray-200">
        <span className="font-medium">Resultados sin guardar</span>
        {count ? ` · ${count} parcela${count === 1 ? "" : "s"}` : ""}. Si cierras o recargas se pierden.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={discardAnalysisDraft}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-accent-contrast hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.75} />}
          Guardar corrida
        </button>
      </div>
    </div>
  );
}
