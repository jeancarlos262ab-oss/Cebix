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

const LOW_END_GPUS = [
  /intel.*hd graphics [2-4]\d{3}/i,
  /intel.*graphics media accelerator/i,
  /swiftshader/i,
  /llvmpipe/i,
];

/**
 * Sonda del equipo: se hace UNA sola vez por sesión, con UN solo contexto WebGL de prueba (que se libera al
 * terminar). Antes se creaban hasta tres contextos por cada mapa que se abría (detección de motor, detección
 * de equipo limitado y el propio mapa), y en Windows cada uno tarda cientos de ms en arrancar.
 *
 * `failIfMajorPerformanceCaveat` hace que falle si solo hay WebGL por software (lento): en ese caso conviene el
 * mapa ligero. El navegador a veces rechaza el primer contexto (GPU arrancando, contextos recién liberados), así
 * que solo si falla se reintenta una vez.
 */
const probeDevice = lazySingleton(() => {
  const result = { webgl: false, lowEnd: true };
  if (typeof window === "undefined") return result;
  try {
    let gl = null;
    for (let attempt = 0; attempt < 2 && !gl; attempt++) {
      const canvas = document.createElement("canvas");
      gl =
        canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    }
    if (!gl) return result;
    result.webgl = true;

    let lowEnd = false;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase();
      lowEnd = LOW_END_GPUS.some((pattern) => pattern.test(renderer));
    }
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) lowEnd = true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) lowEnd = true;
    result.lowEnd = lowEnd;

    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch (error) {
    console.warn("Error detectando capacidad del dispositivo:", error);
  }
  return result;
});

/**
 * ¿El equipo tiene recursos limitados (GPU integrada vieja, pocos núcleos, poca RAM o sin WebGL)?
 * Reutiliza la sonda única: no crea más contextos WebGL.
 *
 * @returns {boolean}
 */
export function detectLowEndDevice() {
  return probeDevice().lowEnd;
}

/** ¿El navegador puede crear un contexto WebGL de verdad (con aceleración por hardware)? */
function supportsWebGL() {
  return probeDevice().webgl;
}

/**
 * Motor de mapas forzado (para pruebas):
 *
 *   "lite" → siempre Leaflet (ParcelMapLite)
 *   "gl"   → siempre MapLibre GL (ParcelMapGL)
 *   null   → automático: MapLibre GL si el equipo acepta WebGL; si no, Leaflet.
 */
const FORCED_MAP_ENGINE = null;

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
