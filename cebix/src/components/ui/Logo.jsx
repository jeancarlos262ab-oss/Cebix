import { memo, useEffect, useRef } from "react";

/**
 * Logo de CEBIX: isotipo dibujado con <canvas> (cuatro piezas achaflanadas que forman
 * una "X" abierta) + wordmark CEBIX.
 *
 * El isotipo toma el color del texto del contenedor (`currentColor`), así que
 * funciona en tema claro/oscuro y sobre el panel de marca del Login. Como el
 * canvas no entiende `currentColor`, se lee el color calculado y se vuelve a
 * dibujar cuando cambia el tema/acento (clase o data-attrs de <html>) o el
 * tamaño.
 *
 * @param {{
 *   className?: string,
 *   size?: "sm" | "md" | "lg" | "xl" | "hero" | "display",
 *   tone?: "auto" | "contrast" | "inherit" | "white",
 *   showText?: boolean,   // false => solo el isotipo
 *   aspect?: number,      // estiramiento horizontal del isotipo (1 = proporción natural; >1 = más ancho)
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

/* ---- Geometría del isotipo (cuadrícula de 1252.90 × 737) ---- */
const W0 = 1252.90;
const H0 = 737;
const RATIO = W0 / H0; // proporción natural del isotipo (rectangular, más ancho que alto)
// Alto del isotipo en em (el ancho sale de RATIO). Solo el isotipo: 0.7em.
// Junto al wordmark CEBIX va más grande (1.05em) para que pese más que el título.
const MARK_H = 0.7;
const MARK_H_WITH_TEXT = 1.05;

// Isotipo original de CEBIX, sin perspectiva: cuatro piezas con esquinas
// achaflanadas que forman una "X" abierta, ensanchadas 1.7× en horizontal (hueco
// central de 33, igual en ambos sentidos) para que se vean rectangulares. Las
// piezas son reflejo una de otra en x e y. Los huecos blancos son geometría
// real, así que el fondo queda transparente.
const PIECES = [
  [[0.00, 0.00], [353.49, 0.00], [609.95, 148.00], [609.95, 352.00], [233.93, 352.00], [0.00, 217.00]],
  [[1252.90, 0.00], [899.41, 0.00], [642.95, 148.00], [642.95, 352.00], [1018.97, 352.00], [1252.90, 217.00]],
  [[0.00, 737.00], [353.49, 737.00], [609.95, 589.00], [609.95, 385.00], [233.93, 385.00], [0.00, 520.00]],
  [[1252.90, 737.00], [899.41, 737.00], [642.95, 589.00], [642.95, 385.00], [1018.97, 385.00], [1252.90, 520.00]],
];

function drawMark(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(canvas).color;

  // El canvas ya tiene la proporción del isotipo (× `aspect`, que estira en horizontal).
  const sx = w / W0;
  const sy = h / H0;

  PIECES.forEach((piece) => {
    ctx.beginPath();
    piece.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px * sx, py * sy);
      else ctx.lineTo(px * sx, py * sy);
    });
    ctx.closePath();
    ctx.fill();
  });
}

function LogoMark({ className = "", aspect = 1, height = MARK_H, tone = "auto" }) {
  const ref = useRef(null);
  const redrawRef = useRef(null); // redibujo animado, compartido por el efecto de tono y el observer
  const mounted = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    // El color del logo cambia con una transición CSS (p. ej. al entrar/salir del mapa satelital o
    // al cambiar de tema). El canvas no entiende transiciones, así que se redibuja en cada cuadro
    // mientras dura (leyendo el color ya interpolado) y queda con el color final.
    let id = 0;
    const animateRedraw = (ms = 450) => {
      cancelAnimationFrame(id);
      const t0 = performance.now();
      const tick = (t) => {
        drawMark(canvas);
        if (t - t0 < ms) id = requestAnimationFrame(tick);
      };
      id = requestAnimationFrame(tick);
    };
    redrawRef.current = animateRedraw;

    const redraw = () => drawMark(canvas);
    redraw();

    const ro = new ResizeObserver(redraw);
    ro.observe(canvas);

    // Cambio de tema o acento: el color heredado cambia sin que cambie el tamaño.
    const mo = new MutationObserver(() => animateRedraw());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent", "data-theme"],
    });

    return () => {
      cancelAnimationFrame(id);
      redrawRef.current = null;
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  // Cambio de tono (o de una clase "dark" de un contenedor, como el sidebar sobre el mapa
  // satelital): cambia el color heredado pero no el tamaño ni <html>.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true; // primer montaje: ya lo dibujó el efecto anterior
      return;
    }
    redrawRef.current?.();
  }, [tone]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
      style={{ width: `${height * RATIO * aspect}em`, height: `${height}em` }}
    />
  );
}

function Logo({ className = "", size = "md", tone = "auto", showText = true, aspect = 1 }) {
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
      <LogoMark aspect={aspect} height={showText ? MARK_H_WITH_TEXT : MARK_H} tone={tone} />
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
