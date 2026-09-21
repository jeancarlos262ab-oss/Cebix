/**
 * AppStorage — Singleton de persistencia local.
 *
 * Todas las pantallas guardan y leen sus datos (parcelas propias, envíos a
 * comité, usuarios, cuenta, preferencias) a través de esta única instancia,
 * en lugar de que cada contexto/hook repita su propio try/catch sobre
 * `localStorage`.
 *
 * Si `localStorage` no está disponible (modo privado, cuota llena, etc.) los
 * datos se conservan en memoria mientras dure la sesión, así la app no se
 * rompe ni pierde lo capturado antes de recargar.
 *
 * Uso:
 *   import { appStorage } from "../services/AppStorage";
 *   const list = appStorage.getJSON("cebix-custom-parcels", []);
 *   appStorage.setJSON("cebix-custom-parcels", next);
 */
let instance = null;

function pickStore() {
  try {
    return typeof window !== "undefined" ? window.localStorage ?? null : null;
  } catch {
    return null; // acceder a localStorage puede lanzar (p. ej. cookies bloqueadas)
  }
}

class AppStorage {
  constructor() {
    if (instance) {
      throw new Error("AppStorage es un singleton: usa AppStorage.getInstance().");
    }
    this.store = pickStore();
    this.memory = new Map(); // respaldo (y espejo) de lo guardado en esta sesión
  }

  static getInstance() {
    if (!instance) instance = new AppStorage();
    return instance;
  }

  /** Lee y parsea un valor JSON; si no existe o está corrupto devuelve `fallback`. */
  getJSON(key, fallback = null) {
    let raw = null;
    try {
      raw = this.store?.getItem(key) ?? null;
    } catch {
      raw = null;
    }
    if (raw === null) raw = this.memory.get(key) ?? null;
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  /** Guarda un valor serializado como JSON. Nunca lanza. */
  setJSON(key, value) {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try {
      this.store?.setItem(key, raw);
    } catch {
      // Sin espacio o sin acceso: queda solo en memoria.
    }
  }

  /** Elimina una clave. Nunca lanza. */
  remove(key) {
    this.memory.delete(key);
    try {
      this.store?.removeItem(key);
    } catch {
      // ignorar
    }
  }
}

export default AppStorage;
export const appStorage = AppStorage.getInstance();
