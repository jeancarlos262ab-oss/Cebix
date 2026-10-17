/**
 * Modo de predicción elegido en la interfaz:
 *   "lluvia" → solo la lluvia de abril–mayo (modelo en producción, el más preciso en la validación)
 *   "10var"  → Plan B: las 10 variables (lluvia + índices Sentinel-2/Landsat)
 * Se guarda en este dispositivo y lo comparten todas las pantallas; `predictCsv` y `predictFromGeometry`
 * lo envían al backend (parámetro `modo`) sin que cada pantalla tenga que pasarlo.
 */
import { useSyncExternalStore } from "react";
import { appStorage } from "./AppStorage";

export const MODES = ["lluvia", "10var"];
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
