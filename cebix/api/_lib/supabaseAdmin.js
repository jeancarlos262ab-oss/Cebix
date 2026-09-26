import { createClient } from "@supabase/supabase-js";

// Este cliente usa la Service Role Key: puede crear usuarios, confirmar su
// correo y cambiar contraseñas sin pasar por las políticas normales de
// Supabase. Por eso SOLO se importa desde /api (código que corre en el
// servidor de Vercel) y jamás desde /src (código que corre en el navegador).
//
// Variables de entorno requeridas en el proyecto de Vercel:
//   SUPABASE_URL                -> misma URL que VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   -> Settings -> API -> service_role (secreta)
let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/** Busca un usuario de auth.users por correo. Devuelve null si no existe. */
export async function findUserByEmail(email) {
  const admin = supabaseAdmin();
  const target = email.trim().toLowerCase();

  // La API admin no tiene "get user by email" directo, así que paginamos
  // listUsers(). Para el tamaño de equipo de este proyecto (decenas o
  // cientos de cuentas) es más que suficiente; si el equipo crece mucho,
  // esto se puede cambiar por una vista/función SQL con índice en email.
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 25; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}
