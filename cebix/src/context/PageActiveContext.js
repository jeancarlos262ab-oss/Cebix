import { createContext, useContext } from "react";

/**
 * Indica si la pantalla donde está montado un componente es la que se ve ahora.
 * Con el keep-alive las pantallas ocultas siguen montadas; los componentes con
 * trabajo continuo (animaciones, bucles requestAnimationFrame...) lo usan para
 * pausarse mientras su pantalla está en segundo plano.
 */
export const PageActiveContext = createContext(true);

export function usePageActive() {
  return useContext(PageActiveContext);
}
