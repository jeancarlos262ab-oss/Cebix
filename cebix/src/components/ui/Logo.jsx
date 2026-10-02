import { memo } from "react";
/**
 * Wordmark de la marca: CEBIX en mayúsculas, negrita, tipografía Garet
 * (con Poppins como respaldo si Garet no está instalada en el sistema)
 * e inclinado en diagonal para dar sensación de movimiento/dato en órbita.
 *
 * @param {{className?: string, size?: "sm" | "md" | "lg" | "xl" | "hero", tone?: "auto" | "contrast" | "inherit"}} props
 * tone "contrast" usa siempre --accent-contrast (para fondos sólidos de
 * acento); "inherit" toma el color del contenedor (panel de marca de
 * Login/Signup); "auto" (default) usa gray-900/white según el tema, para
 * fondos blancos/negros normales.
 */
const SIZES = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
  // Tamaño "hero" para el panel de marca de Login/Signup en escritorio.
  hero: "text-5xl xl:text-6xl",
};

function Logo({ className = "", size = "md", tone = "auto" }) {
  let toneClass = "text-gray-900 dark:text-white";
  if (tone === "contrast") toneClass = "text-[color:var(--accent-contrast)]";
  if (tone === "inherit") toneClass = "";

  return (
    <span
      className={`inline-block select-none font-garet font-extrabold uppercase leading-none tracking-tight ${toneClass} ${SIZES[size]} ${className}`}
      style={{ transform: "skewX(-12deg)" }}
    >
      CEBIX
    </span>
  );
}

export default memo(Logo);
