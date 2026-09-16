import { memo } from "react";
/**
 * Wordmark de la marca: CEBIX en mayúsculas, negrita, tipografía Garet
 * (con Poppins como respaldo si Garet no está instalada en el sistema)
 * e inclinado en diagonal para dar sensación de movimiento/dato en órbita.
 *
 * @param {{className?: string, size?: "sm" | "md" | "lg" | "xl"}} props
 */
const SIZES = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

function Logo({ className = "", size = "md" }) {
  return (
    <span
      className={`inline-block select-none font-garet font-extrabold uppercase leading-none tracking-tight text-gray-900 dark:text-white ${SIZES[size]} ${className}`}
      style={{ transform: "skewX(-12deg)" }}
    >
      CEBIX
    </span>
  );
}

export default memo(Logo);
