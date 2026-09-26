/**
 * Icono de ubicación (pin) para los mapas de solo visualización.
 * Misma silueta que el pin de la tabla de parcelas (rojo, con hueco central).
 * La punta del pin está en (12, 22) del viewBox de 24x24.
 */
const PIN_PATH =
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";

export const PIN_SIZE = 36;
/** Distancia (px) desde el borde inferior del svg hasta la punta real del pin. */
export const PIN_TIP_OFFSET = Math.round(((24 - 22) / 24) * PIN_SIZE);

export default function LocationPin({ size = PIN_SIZE }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.45))" }}
      aria-hidden="true"
    >
      <path d={PIN_PATH} fill="#DC2626" stroke="#ffffff" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="3" fill="#ffffff" />
    </svg>
  );
}

/** Versión en string para L.divIcon de Leaflet. */
export function locationPinHtml(size = PIN_SIZE) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.45))" aria-hidden="true"><path d="${PIN_PATH}" fill="#DC2626" stroke="#ffffff" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>`;
}
