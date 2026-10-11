/**
 * `toast` con sonido. Misma API que `toast` de sonner (success, error, warning, info, loading, message,
 * dismiss, promise…), pero cada notificación que aparece en la esquina inferior derecha reproduce un
 * sonido de la librería react-sounds (los sonidos vienen incluidos, no hay archivos propios):
 *
 *   éxito      -> notification/success
 *   error      -> notification/error
 *   aviso      -> notification/warning
 *   info       -> notification/info
 *   cargando   -> notification/popup   (una sola vez por aviso aunque se actualice su texto)
 *   genérica   -> notification/message
 *
 * Uso: `import { toast } from "../services/toast";` (en vez de "sonner").
 * Si el audio no está disponible (navegador sin permiso, sin red al CDN de los sonidos) la notificación
 * se muestra igual: el sonido nunca rompe nada.
 */
import { toast as base } from "sonner";
import { playSound, preloadSounds } from "react-sounds";
import { appStorage } from "./AppStorage";

const SOUNDS = {
  success: "notification/success",
  error: "notification/error",
  warning: "notification/warning",
  info: "notification/info",
  loading: "notification/popup",
  message: "notification/message",
};
const VOLUME = 0.6;

// Preferencia del usuario (Ajustes -> Notificaciones -> Sonido). Se guarda en este dispositivo.
const SOUND_PREF_KEY = "cebix-toast-sound";
let soundOn = appStorage.getJSON(SOUND_PREF_KEY, true) !== false;

export const isToastSoundEnabled = () => soundOn;
export function setToastSoundEnabled(enabled) {
  soundOn = Boolean(enabled);
  appStorage.setJSON(SOUND_PREF_KEY, soundOn);
}

function play(kind) {
  if (!soundOn) return;
  try {
    Promise.resolve(playSound(SOUNDS[kind], { volume: VOLUME })).catch(() => {});
  } catch {
    // sin audio: se ignora
  }
}

/** Baja a memoria los sonidos al arrancar para que no haya retraso la primera vez que suenan. */
export function preloadToastSounds() {
  try {
    Promise.resolve(preloadSounds(Object.values(SOUNDS))).catch(() => {});
  } catch {
    // ignorar
  }
}

// Avisos "cargando" con id propio que ya están en pantalla: al actualizarlos no vuelven a sonar.
const loadingIds = new Set();

function withSound(kind, fn) {
  return (message, data) => {
    const id = data?.id;
    if (kind === "loading" && id !== undefined) {
      if (!loadingIds.has(id)) play("loading");
      loadingIds.add(id);
    } else {
      if (id !== undefined) loadingIds.delete(id);
      play(kind);
    }
    return fn(message, data);
  };
}

const toast = Object.assign((message, data) => withSound("message", base)(message, data), base, {
  success: withSound("success", base.success),
  error: withSound("error", base.error),
  warning: withSound("warning", base.warning),
  info: withSound("info", base.info),
  message: withSound("message", base.message),
  loading: withSound("loading", base.loading),
  dismiss: (id) => {
    if (id !== undefined) loadingIds.delete(id);
    return base.dismiss(id);
  },
  promise: (promise, data) => {
    // Suena al resolverse (éxito o error); lo que pase en `data` decide el texto.
    Promise.resolve(promise).then(
      () => play("success"),
      () => play("error")
    );
    return base.promise(promise, data);
  },
});

export { toast };
