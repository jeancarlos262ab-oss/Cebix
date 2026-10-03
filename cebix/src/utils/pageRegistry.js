import { lazySingleton } from "./singleton";

/**
 * Registro SINGLETON de pantallas.
 *
 * Se crea una sola vez (lazySingleton) y toda la app comparte esta misma
 * instancia. Guarda UNA sola instancia por pantalla:
 *   - entries: pantalla montada (su elemento React y su última ubicación)
 *   - scroll:  última posición de scroll de cada pantalla
 *   - search:  último ?query de cada pantalla (pestañas, filtros...)
 *   - active:  clave de la pantalla visible ahora mismo
 *
 * Como el registro es único, cambiar de pantalla y volver reutiliza siempre
 * la misma instancia y la deja exactamente como estaba.
 */
export const getPageRegistry = lazySingleton(() => ({
  entries: new Map(),
  scroll: new Map(),
  search: new Map(),
  active: { key: null },
}));

/** Vacía el registro (se llama al cerrar sesión para no filtrar estado entre usuarios). */
export function resetPageRegistry() {
  const r = getPageRegistry();
  r.entries.clear();
  r.scroll.clear();
  r.search.clear();
  r.active.key = null;
}
