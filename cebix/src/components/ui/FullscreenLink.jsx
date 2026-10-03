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
      className="flex h-9 w-9 items-center justify-center rounded-full text-accent-600 transition-colors hover:bg-gray-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:bg-gray-800"
    >
      <Maximize2 size={18} />
    </Link>
  );
}
