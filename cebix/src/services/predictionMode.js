import { useSyncExternalStore } from "react";
import { appStorage } from "./AppStorage";

export const MODES = ["lluvia", "10var", "ciclo"];
const KEY = "cebix-prediction-mode";
const listeners = new Set();
let current = (() => {
  const saved = appStorage.getJSON(KEY, "lluvia");
  return MODES.includes(saved) ? saved : "lluvia";
})();

export function getPredictionMode() {
  return current;
}

export function setPredictionMode(mode) {
  if (!MODES.includes(mode) || mode === current) return;
  current = mode;
  appStorage.setJSON(KEY, mode);
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePredictionMode() {
  const mode = useSyncExternalStore(subscribe, getPredictionMode, getPredictionMode);
  return [mode, setPredictionMode];
}