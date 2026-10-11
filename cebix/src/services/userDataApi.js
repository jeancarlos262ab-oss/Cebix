/**
 * Persistencia en Supabase de lo que antes vivía solo en localStorage:
 *   - user_analysis         -> última corrida del modelo / importación (una fila por usuario)
 *   - committee_submissions -> parcelas enviadas a comité
 *
 * Todas las funciones devuelven { data, error } y nunca lanzan.
 * Tablas y políticas RLS: supabase/datos_por_usuario.sql
 */
import { supabase } from "./supabaseClient";

export async function fetchAnalysis(uid) {
  try {
    const { data, error } = await supabase
      .from("user_analysis")
      .select("file_name, run_at, parcels")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) return { data: null, error };
    if (!data || !Array.isArray(data.parcels) || data.parcels.length === 0) return { data: null, error: null };
    return { data: { parcels: data.parcels, fileName: data.file_name ?? "", runAt: data.run_at }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function saveAnalysis(uid, analysis) {
  try {
    if (!analysis) {
      const { error } = await supabase.from("user_analysis").delete().eq("user_id", uid);
      return { error };
    }
    const { error } = await supabase.from("user_analysis").upsert(
      {
        user_id: uid,
        file_name: analysis.fileName ?? "",
        run_at: analysis.runAt ?? new Date().toISOString(),
        parcels: analysis.parcels ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function fetchSubmissions(uid) {
  try {
    const { data, error } = await supabase
      .from("committee_submissions")
      .select("parcel_id, submitted_at")
      .eq("user_id", uid);
    if (error) return { data: null, error };
    return { data: Object.fromEntries(data.map((r) => [r.parcel_id, r.submitted_at])), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function saveSubmission(uid, parcelId, submittedAt) {
  try {
    const { error } = await supabase
      .from("committee_submissions")
      .upsert({ user_id: uid, parcel_id: String(parcelId), submitted_at: submittedAt }, { onConflict: "user_id,parcel_id" });
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function saveSubmissions(uid, map) {
  try {
    const rows = Object.entries(map).map(([id, at]) => ({ user_id: uid, parcel_id: String(id), submitted_at: at }));
    if (rows.length === 0) return { error: null };
    const { error } = await supabase.from("committee_submissions").upsert(rows, { onConflict: "user_id,parcel_id" });
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function deleteSubmissions(uid, parcelIds) {
  try {
    if (parcelIds.length === 0) return { error: null };
    const { error } = await supabase
      .from("committee_submissions")
      .delete()
      .eq("user_id", uid)
      .in("parcel_id", parcelIds.map(String));
    return { error };
  } catch (error) {
    return { error };
  }
}
