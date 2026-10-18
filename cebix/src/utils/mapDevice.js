import { appStorage } from "../services/AppStorage";
import { lazySingleton } from "./singleton";

const STORAGE_KEY = "cebix:mapEngine";

const LOW_END_GPUS = [
  /intel.*hd graphics [2-4]\d{3}/i,
  /intel.*graphics media accelerator/i,
  /swiftshader/i,
  /llvmpipe/i,
];

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

export function detectLowEndDevice() {
  return probeDevice().lowEnd;
}

function supportsWebGL() {
  return probeDevice().webgl;
}

const FORCED_MAP_ENGINE = null;

let glFailed = false;

const detectEngine = lazySingleton(() => {
  appStorage.remove(STORAGE_KEY);
  if (FORCED_MAP_ENGINE) return FORCED_MAP_ENGINE;
  return supportsWebGL() ? "gl" : "lite";
});

export function reportGLFailure() {
  glFailed = true;
}

export function resolveMapEngine() {
  if (glFailed) return "lite";
  return detectEngine();
}