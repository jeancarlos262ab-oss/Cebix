import { supabase } from "./supabaseClient";

/**
 * Envía al servidor una foto compacta del portafolio (/api/portfolio-sync).
 * El servidor la compara con la anterior: si alguna parcela pasó a semáforo rojo o amarillo manda la
 * alerta por correo (respetando las preferencias de Ajustes) y deja guardada la foto para el resumen
 * semanal. Nunca debe romper la app: cualquier fallo se devuelve como { error }.
 */
export async function syncPortfolio(parcels) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { error: new Error("sin sesión") };
    const response = await fetch("/api/portfolio-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ parcels }),
    });
    if (!response.ok) return { error: new Error(`portfolio-sync ${response.status}`) };
    return { error: null };
  } catch (error) {
    return { error };
  }
}
