import { Info } from "lucide-react";

// Aviso para cualquier pantalla que calcula contra el servidor. En Render el
// servidor se duerme y la primera petición puede quedarse colgada: cancelar y
// volver a calcular lo despierta.
export const SLOW_HINT_TEXT =
  "Si tarda mucho en calcularse, cancela el cálculo y vuelve a intentarlo: casi siempre se arregla (el servidor se duerme cuando no se usa y la primera petición puede quedarse colgada).";

export default function SlowHint({ className = "" }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400 ${className}`}
    >
      <Info size={13} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{SLOW_HINT_TEXT}</span>
    </p>
  );
}
