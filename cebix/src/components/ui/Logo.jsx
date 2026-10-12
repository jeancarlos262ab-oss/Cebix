import { memo } from "react";

/**
 * Logo de CEBIX: isotipo (tres piezas: chevron izquierdo cerrado + dos piezas a la derecha que forman una "X") + wordmark CEBIX.
 *
 * El isotipo es un SVG con `fill="currentColor"`: toma el color del texto del contenedor, así que
 * funciona en tema claro/oscuro, sobre el panel de marca del Login y con las transiciones de color.
 *
 * @param {{
 *   className?: string,
 *   size?: "sm" | "md" | "lg" | "xl" | "hero" | "display",
 *   tone?: "auto" | "contrast" | "inherit" | "white",
 *   showText?: boolean,   // false => solo el isotipo
 * }} props
 * tone "contrast" usa siempre --accent-contrast (fondos sólidos de acento);
 * "white" fuerza blanco siempre; "inherit" toma el color del contenedor (panel de marca de Login/Signup);
 * "auto" (default) usa gray-900/white según el tema.
 */
const SIZES = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
  hero: "text-5xl xl:text-6xl",
  // Isotipo grande para la pantalla de acceso.
  display: "text-6xl lg:text-7xl xl:text-8xl",
};

/* ---- Geometría del isotipo (cuadrícula de 697 × 509) ---- */
const W0 = 697;
const H0 = 509;
const RATIO = W0 / H0; // proporción natural del isotipo
// Alto del isotipo en em (el ancho sale de RATIO). Solo el isotipo: 0.7em.
// Junto al wordmark CEBIX va más grande (1.05em) para que pese más que el título.
const MARK_H = 0.7;
const MARK_H_WITH_TEXT = 1.05;

// Los huecos entre piezas son geometría real, así que el fondo queda transparente.
const MARK_PATH = [
  // Pieza izquierda cerrada: las dos piezas de la izquierda forman un solo chevron ">".
  "M16 0H206L453 253L195 508H0L258 253Z",
  "M689 0H501L377 122L471 222Z",
  "M374 374L501 508H696L471 283Z",
].join("");

function LogoMark({ height = MARK_H }) {
  return (
    <svg
      viewBox={`0 0 ${W0} ${H0}`}
      aria-hidden="true"
      className="block shrink-0"
      style={{ width: `${height * RATIO}em`, height: `${height}em` }}
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

function Logo({ className = "", size = "md", tone = "auto", showText = true }) {
  let toneClass = "text-gray-900 dark:text-white";
  if (tone === "contrast") toneClass = "text-(--accent-contrast)";
  if (tone === "inherit") toneClass = "";
  // "white": siempre blanco, sin importar el tema (p. ej. sobre el sidebar oscuro).
  if (tone === "white") toneClass = "text-white!";

  return (
    <span
      role="img"
      aria-label="CEBIX"
      className={`inline-flex select-none items-center gap-[0.32em] leading-none transition-colors duration-300 ease-out ${toneClass} ${SIZES[size]} ${className}`}
    >
      <LogoMark height={showText ? MARK_H_WITH_TEXT : MARK_H} />
      {showText && (
        <span
          aria-hidden="true"
          className="font-garet font-extrabold uppercase leading-none tracking-tight"
        >
          CEBIX
        </span>
      )}
    </span>
  );
}

export default memo(Logo);
