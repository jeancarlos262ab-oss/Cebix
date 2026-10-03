import { memo, useEffect, useRef } from "react";

/**
 * Logo de CEBIX: isotipo dibujado con <canvas> (cuatro piezas con esquinas
 * achaflanadas que forman una "X" abierta) + wordmark CEBIX.
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
 *   aspect?: number,      // ancho/alto del isotipo (1 = cuadrado; >1 = estirado)
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

/* ---- Geometría del isotipo (cuadrícula de 737 × 737) ---- */
const U = 737;
// Pieza superior izquierda (cuadrante de 352 × 352, chaflanes a 45°). Las otras
// tres son su reflejo en x e y, así que el hueco central es idéntico (33) en
// horizontal y en vertical.
const PIECE = [
  [0, 0],
  [204, 0],
  [352, 148],
  [352, 352],
  [135, 352],
  [0, 217],
];

function drawMark(canvas, aspect = 1) {
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

  // Alto fijo = U unidades; ancho = U × aspect. El hueco central (33) se
  // mantiene igual en horizontal y vertical aunque el isotipo se estire: solo
  // las piezas se ensanchan.
  const s = h / U;
  const W = U * aspect;
  const kx = (W - 33) / (2 * 352);

  [false, true].forEach((flipY) => {
    [false, true].forEach((flipX) => {
      ctx.beginPath();
      PIECE.forEach(([px, py], i) => {
        const ux = px * kx;
        const x = (flipX ? W - ux : ux) * s;
        const y = (flipY ? U - py : py) * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    });
  });
}

function LogoMark({ className = "", aspect = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const redraw = () => drawMark(canvas, aspect);
    redraw();

    const ro = new ResizeObserver(redraw);
    ro.observe(canvas);

    // Cambio de tema o acento: el color heredado cambia sin que cambie el tamaño.
    // Doble rAF: espera a que el navegador aplique el nuevo tema antes de leer el color.
    const mo = new MutationObserver(() => requestAnimationFrame(() => requestAnimationFrame(redraw)));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent", "data-theme"],
    });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [aspect]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
      style={{ width: `${0.95 * aspect}em`, height: "0.95em" }}
    />
  );
}

function Logo({ className = "", size = "md", tone = "auto", showText = true, aspect = 1 }) {
  let toneClass = "text-gray-900 dark:text-white";
  if (tone === "contrast") toneClass = "text-[color:var(--accent-contrast)]";
  if (tone === "inherit") toneClass = "";
  // "white": siempre blanco, sin importar el tema (p. ej. sobre el sidebar oscuro).
  if (tone === "white") toneClass = "!text-white";

  return (
    <span
      role="img"
      aria-label="CEBIX"
      className={`inline-flex select-none items-center gap-[0.32em] leading-none ${toneClass} ${SIZES[size]} ${className}`}
    >
      <LogoMark aspect={aspect} />
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
