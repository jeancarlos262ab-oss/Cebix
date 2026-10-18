import { useCallback } from "react";
import { toast } from "../services/toast";
import { useParcels } from "../context/ParcelsContext";

export default function useParcelActions() {
  const { addParcel, updateParcel, removeParcel, removeParcels } = useParcels();

  
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

  
  const importParcels = useCallback(
    async (records) => {
      let failed = 0;
      let message = null;
      const failedRecords = [];
      for (const record of records) {
        const result = await addParcel(record);
        if (result?.error) {
          failed += 1;
          failedRecords.push(record);
          message ??= result.error.message;
        }
      }
      return { failed, message, failedRecords };
    },
    [addParcel]
  );

  return { saveParcel, deleteParcel, deleteParcels, importParcels };
}