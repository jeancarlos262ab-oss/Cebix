/**
 * Degradados suaves para desvanecer un mapa hacia el fondo de la app (blanco en modo claro, negro en oscuro).
 *
 * Un degradado lineal "color → transparente" deja ver su final como una banda
 * porque la pendiente cambia de golpe. Aquí la opacidad sigue una curva
 * smootherstep (pendiente cero en ambos extremos) muestreada en varias paradas,
 * así no se distingue dónde empieza ni dónde termina el desvanecido.
 */
const STEPS = 16;
// Color del fondo de la app: blanco en modo claro, negro en oscuro (ver --page-bg en index.css).
const FADE_COLOR = "var(--page-bg, #000)";

const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * @param {"to right" | "to top"} direction
 * @param {string} start   Dónde termina la zona sólida (CSS length, p. ej. "var(--sidebar-edge, 0px)").
 * @param {string} length  Largo del desvanecido (CSS length, p. ej. "28rem").
 * @param {number} [strength=1] Opacidad máxima del color en el borde (0–1). Menos de 1 deja
 *   el borde semitransparente para que el desvanecido sea más sutil.
 */
export function softFadeGradient(direction, start, length, strength = 1) {
  const stops = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const opacity = Math.round((1 - smootherstep(t)) * strength * 1000) / 10; // strength*100 → 0
    const pos = `calc(${start} + ${length} * ${t.toFixed(4)})`;
    stops.push(
      opacity >= 100
        ? `${FADE_COLOR} ${pos}`
        : opacity <= 0
          ? `transparent ${pos}`
          : `color-mix(in srgb, ${FADE_COLOR} ${opacity}%, transparent) ${pos}`
    );
  }
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

export const LEFT_FADE_LENGTH = "12rem";
export const BOTTOM_FADE_LENGTH = "9rem";
// El borde inferior no llega a negro sólido: se nota mucho menos.
export const BOTTOM_FADE_STRENGTH = 0.55;
