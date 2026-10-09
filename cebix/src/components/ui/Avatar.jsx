import { useEffect, useState } from "react";

function initialsOf(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Foto de perfil redonda. Si no hay foto (o no carga) muestra las iniciales,
 * en vez de la cara aleatoria de un servicio externo.
 */
export default function Avatar({ src, name, className = "h-9 w-9", textClass = "text-xs" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || "Foto de perfil"}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name || "Sin foto de perfil"}
      className={`${className} ${textClass} flex shrink-0 select-none items-center justify-center rounded-full bg-accent-50 font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400`}
    >
      {initialsOf(name)}
    </span>
  );
}
