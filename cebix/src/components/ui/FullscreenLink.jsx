import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";

/**
 * Enlace a la lista de parcelas en pantalla completa (/parcelas/historial).
 * Solo icono, sin contorno ni texto; el texto queda en aria-label y title.
 */
export default function FullscreenLink({ to = "/parcelas/historial" }) {
  return (
    <Link
      to={to}
      aria-label="Ver en pantalla completa"
      title="Ver en pantalla completa"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <Maximize2 size={17} strokeWidth={1.75} />
    </Link>
  );
}
