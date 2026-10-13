/**
 * Degradado de acento de la esquina superior izquierda. Es UN solo componente (clase `app-corner-glow`, de index.css)
 * que usan el layout de la app y el mapa satelital, con la misma posición y tamaño (absolute inset-0): solo cambia
 * la capa (`className`) según dónde se monte.
 */
export default function CornerGlow({ className = "" }) {
  return <div aria-hidden="true" className={`app-corner-glow pointer-events-none absolute inset-0 ${className}`} />;
}
