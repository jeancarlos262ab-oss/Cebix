import { supabase } from "./supabaseClient";

const BUCKET = "avatars";
export const AVATAR_SIZE = 256; // miniatura cuadrada (barra lateral, perfil); la original se guarda aparte
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
 * Miniatura: recorta al centro en cuadrado y reduce a 256x256 (WebP, ~10-20 KB) para la barra
 * lateral y el perfil. La foto ORIGINAL se sube aparte y sin tocar (ver uploadAvatar).
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

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

/** Borra todas las fotos anteriores de la persona (queda una sola carpeta limpia). */
async function removeAllFor(userId, keep = []) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => !keep.includes(p));
  if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Sube la miniatura Y el archivo original sin tocar (mismos bytes, misma calidad).
 * Devuelve { thumbUrl, fullUrl }.
 */
export async function uploadAvatar(userId, thumbBlob, originalFile) {
  // Nombres nuevos cada vez: evita que el navegador/CDN siga mostrando la foto vieja en caché.
  const stamp = Date.now();
  const thumbPath = `${userId}/thumb-${stamp}.webp`;
  const fullPath = `${userId}/original-${stamp}.${EXT[originalFile.type] ?? "jpg"}`;
  const opts = { cacheControl: "31536000", upsert: false };

  const { error: thumbError } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumbBlob, { ...opts, contentType: "image/webp" });
  if (thumbError) throw thumbError;

  const { error: fullError } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, originalFile, { ...opts, contentType: originalFile.type });
  if (fullError) {
    await supabase.storage.from(BUCKET).remove([thumbPath]);
    throw fullError;
  }

  const { data: thumb } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
  const { data: full } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  removeAllFor(userId, [thumbPath, fullPath]).catch(() => {}); // limpieza: si falla, no importa
  return { thumbUrl: thumb.publicUrl, fullUrl: full.publicUrl };
}

/** Quita la foto guardada de la persona. */
export async function deleteAvatar(userId) {
  await removeAllFor(userId);
}

/** Traduce los errores típicos de Supabase Storage a algo que se entienda. */
export function avatarErrorMessage(err) {
  const msg = String(err?.message ?? err ?? "");
  if (/bucket not found/i.test(msg)) return "Falta crear el bucket «avatars» en Supabase (corre supabase/avatars_storage.sql).";
  if (/row-level security|not authorized|unauthorized|403/i.test(msg)) return "No tienes permiso para guardar la foto. Vuelve a iniciar sesión.";
  if (/too large|payload|413|size/i.test(msg)) return "La imagen es demasiado grande.";
  return msg || "No se pudo guardar la foto.";
}
