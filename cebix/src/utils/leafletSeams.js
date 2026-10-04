/**
 * Quita las "cuadrículas" del mapa: las líneas finas que se ven entre teselas de Leaflet
 * (el navegador deja un hueco de sub-píxel en los bordes y se asoma el fondo).
 *
 * Cada tesela se dibuja 1 px más grande que su celda, así se solapa con la vecina y no
 * queda ningún hueco. Es la misma imagen, por lo que el solape no se nota.
 * Se aplica una sola vez a todas las capas de Leaflet de la app: basta con importar este archivo.
 */
import L from "leaflet";

if (!L.GridLayer.prototype.__noSeams) {
  const initTile = L.GridLayer.prototype._initTile;
  L.GridLayer.include({
    __noSeams: true,
    _initTile(tile) {
      initTile.call(this, tile);
      const size = this.getTileSize();
      tile.style.width = `${size.x + 1}px`;
      tile.style.height = `${size.y + 1}px`;
    },
  });
}
