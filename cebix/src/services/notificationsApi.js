import { supabase } from "./supabaseClient";

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