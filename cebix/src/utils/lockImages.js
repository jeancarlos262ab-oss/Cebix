/**
 * Bloquea TODAS las imágenes de la app igual que cebada.webp: no se pueden arrastrar
 * (a otra pestaña, al escritorio o a otro campo) ni abrir con el menú contextual
 * (clic derecho / pulsación larga: "Guardar imagen", "Abrir en pestaña nueva"…).
 *
 * Es global y por delegación en `document`, así que cubre también las imágenes que se
 * crean después (avatar, tiles de Leaflet, fotos de las pantallas, etc.) sin tocar cada <img>.
 * La parte de CSS (user-select / -webkit-user-drag / touch-callout) está en index.css.
 */
export function lockImages() {
  const isImage = (e) => {
    const t = e.target;
    return t instanceof Element && (t.tagName === "IMG" || t.tagName === "PICTURE");
  };
  const block = (e) => {
    if (isImage(e)) e.preventDefault();
  };
  document.addEventListener("dragstart", block, true);
  document.addEventListener("contextmenu", block, true);
}
