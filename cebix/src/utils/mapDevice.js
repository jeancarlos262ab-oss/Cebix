/**
 * Utilidades para decidir qué motor de mapas usar (MapLibre GL WebGL vs
 * Leaflet DOM/Canvas) según los recursos del equipo del usuario.
 *
 * Se separó de ParcelMap.jsx para que tanto la versión "completa" (GL) como
 * el selector automático puedan reutilizar la misma heurística.
 */

import { appStorage } from "../services/AppStorage";
import { lazySingleton } from "./singleton";

const STORAGE_KEY = "cebix:mapEngine";

/**
 * Detecta si el dispositivo tiene recursos limitados (GPU integrada vieja,
 * pocos núcleos, poca RAM o sin WebGL disponible).
 *
 * @returns {boolean}
 */
export function detectLowEndDevice() {
  try {
    if (typeof window === "undefined") return false;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return true;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();

      const lowEndGPUs = [
        /intel.*hd graphics [2-4]\d{3}/i,
        /intel.*graphics media accelerator/i,
        /swiftshader/i,
        /llvmpipe/i,
      ];

      if (lowEndGPUs.some((pattern) => pattern.test(renderer))) {
        return true;
      }
    }

    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
      return true;
    }

    return false;
  } catch (error) {
    console.warn("Error detectando capacidad del dispositivo:", error);
    return true;
  }
}

/**
 * ¿El navegador puede crear un contexto WebGL de verdad (con aceleración por hardware)?
 * `failIfMajorPerformanceCaveat` hace que falle si solo hay WebGL por software (lento),
 * y en ese caso conviene el mapa ligero. Libera el contexto de prueba al terminar.
 *
 * @returns {boolean}
 */
export function supportsWebGL() {
  try {
    if (typeof window === "undefined") return false;
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Motor de mapas forzado (para pruebas):
 *
 *   "lite" → siempre Leaflet (ParcelMapLite)
 *   "gl"   → siempre MapLibre GL (ParcelMapGL)
 *   null   → automático: MapLibre GL si el equipo acepta WebGL; si no, Leaflet.
 */
export const FORCED_MAP_ENGINE = null;

// Se vuelve true si MapLibre GL falla al arrancar aunque la detección dijera que sí.
let glFailed = false;

const detectEngine = lazySingleton(() => {
  appStorage.remove(STORAGE_KEY);
  if (FORCED_MAP_ENGINE) return FORCED_MAP_ENGINE;
  return supportsWebGL() ? "gl" : "lite";
});

/** Avisa de que MapLibre GL no pudo iniciar: desde ahora todos los mapas usan Leaflet. */
export function reportGLFailure() {
  glFailed = true;
}

/**
 * Resuelve qué motor usar. La detección (que crea un contexto WebGL de prueba) se hace una
 * sola vez y todas las pantallas con mapa reutilizan el resultado.
 *
 * @returns {"gl" | "lite"}
 */
export function resolveMapEngine() {
  if (glFailed) return "lite";
  return detectEngine();
}
