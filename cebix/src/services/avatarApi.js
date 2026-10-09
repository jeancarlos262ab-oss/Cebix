import { supabase } from "./supabaseClient";

const BUCKET = "avatars";
export const AVATAR_SIZE = 256; // px del lado; se guarda cuadrada
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // lo que se acepta elegir (se reduce antes de subir)
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Mensaje de error si el archivo no sirve, o null si está bien. */
export function validateAvatarFile(file) {
  if (!file) return "No se eligió ningún archivo.";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Usa una imagen JPG, PNG o WebP.";
  if (file.size > MAX_INPUT_BYTES) return "La imagen pesa más de 10 MB.";
  return null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

/**
 * Recorta al centro en cuadrado y reduce a 256x256 (WebP, ~10-25 KB). Así la foto de un celular
 * de 5 MB no se sube entera ni hace lenta la barra lateral.
 */
export async function prepareAvatar(file) {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

/** Borra todas las fotos anteriores de la persona (queda una sola carpeta limpia). */
async function removeAllFor(userId, keep) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
}

/** Sube la foto ya preparada y devuelve su URL pública. */
export async function uploadAvatar(userId, blob) {
  // Nombre nuevo cada vez: evita que el navegador/CDN siga mostrando la foto vieja en caché.
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  removeAllFor(userId, path).catch(() => {}); // limpieza: si falla, no importa
  return data.publicUrl;
}

/** Quita la foto guardada de la persona. */
export async function deleteAvatar(userId) {
  await removeAllFor(userId, null);
}

/** Traduce los errores típicos de Supabase Storage a algo que se entienda. */
export function avatarErrorMessage(err) {
  const msg = String(err?.message ?? err ?? "");
  if (/bucket not found/i.test(msg)) return "Falta crear el bucket «avatars» en Supabase (corre supabase/avatars_storage.sql).";
  if (/row-level security|not authorized|unauthorized|403/i.test(msg)) return "No tienes permiso para guardar la foto. Vuelve a iniciar sesión.";
  if (/too large|payload|413|size/i.test(msg)) return "La imagen es demasiado grande.";
  return msg || "No se pudo guardar la foto.";
}
