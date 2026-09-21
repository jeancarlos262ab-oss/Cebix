/**
 * Singleton perezoso: `factory` se ejecuta UNA sola vez, la primera vez que
 * alguien pide el valor, y a partir de ahí todas las pantallas reciben la
 * misma instancia.
 *
 * @template T
 * @param {() => T} factory
 * @returns {() => T}
 */
export function lazySingleton(factory) {
  let created = false;
  let value;
  return () => {
    if (!created) {
      value = factory();
      created = true;
    }
    return value;
  };
}
