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
    
  }
}

export function preloadToastSounds() {
  try {
    Promise.resolve(preloadSounds(Object.values(SOUNDS))).catch(() => {});
  } catch {
    
  }
}

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
    
    Promise.resolve(promise).then(
      () => play("success"),
      () => play("error")
    );
    return base.promise(promise, data);
  },
});

export { toast };