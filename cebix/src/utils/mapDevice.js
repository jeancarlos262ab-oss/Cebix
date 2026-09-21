/**
 * Utilidades para decidir qué motor de mapas usar (MapLibre GL WebGL vs
 * Leaflet DOM/Canvas) según los recursos del equipo del usuario.
 *
 * Se separó de ParcelMap.jsx para que tanto la versión "completa" (GL) como
 * el selector automático puedan reutilizar la misma heurística.
 */

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
 * Motor de mapas forzado. Hoy siempre se usa el mapa ligero (Leaflet).
 *
 *   "lite" → siempre Leaflet (ParcelMapLite)
 *   "gl"   → siempre MapLibre GL (ParcelMapGL)
 *   null   → automático según el equipo (detectLowEndDevice)
 *
 * La lógica de MapLibre GL y la detección automática se conservan intactas:
 * para volver a usarlas basta con cambiar este valor a null.
 */
export const FORCED_MAP_ENGINE = "lite";

/**
 * Resuelve qué motor usar. Borra cualquier preferencia manual que haya
 * quedado guardada de la versión anterior (cuando existía el botón de cambio).
 *
 * @returns {"gl" | "lite"}
 */
export function resolveMapEngine() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage no disponible — ignorar
  }
  if (FORCED_MAP_ENGINE) return FORCED_MAP_ENGINE;
  return detectLowEndDevice() ? "lite" : "gl";
}
