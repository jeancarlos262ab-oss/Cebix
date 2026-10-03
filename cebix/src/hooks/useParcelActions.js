import { useCallback } from "react";
import { toast } from "sonner";
import { useParcels } from "../context/ParcelsContext";

/**
 * Operaciones CRUD de parcelas con sus mensajes al usuario. Cada función devuelve
 * `{ error }` para que el formulario o el diálogo puedan mostrar el motivo si algo falla
 * (por ejemplo, un rechazo de Supabase) en lugar de anunciar un éxito que no ocurrió.
 */
export default function useParcelActions() {
  const { addParcel, updateParcel, removeParcel, removeParcels } = useParcels();

  /** Crea (target = null) o edita (target = parcela) y avisa solo si de verdad se guardó. */
  const saveParcel = useCallback(
    async (target, fields) => {
      const result = target ? await updateParcel(target.id, fields) : await addParcel(fields);
      if (!result?.error) toast.success(target ? "Parcela actualizada." : "Parcela agregada.");
      return result;
    },
    [addParcel, updateParcel]
  );

  const deleteParcel = useCallback(
    async (parcel) => {
      const result = await removeParcel(parcel.id);
      if (!result?.error) toast.success(`${parcel.name} eliminada.`);
      return result;
    },
    [removeParcel]
  );

  /** Elimina varias parcelas a la vez (selección múltiple). Recibe la lista de parcelas completas. */
  const deleteParcels = useCallback(
    async (list) => {
      const result = await removeParcels(list.map((parcel) => parcel.id));
      if (!result?.error) {
        toast.success(list.length === 1 ? `${list[0].name} eliminada.` : `${list.length} parcelas eliminadas.`);
      }
      return result;
    },
    [removeParcels]
  );

  /** Alta de varias parcelas (CSV), una por una. Devuelve cuántas fallaron y el primer motivo. */
  const importParcels = useCallback(
    async (records) => {
      let failed = 0;
      let message = null;
      for (const record of records) {
        const result = await addParcel(record);
        if (result?.error) {
          failed += 1;
          message ??= result.error.message;
        }
      }
      return { failed, message };
    },
    [addParcel]
  );

  return { saveParcel, deleteParcel, deleteParcels, importParcels };
}
