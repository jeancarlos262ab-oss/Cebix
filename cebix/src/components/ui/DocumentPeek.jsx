/**
 * Documento sin contorno (hoja gris con esquina doblada y renglones) que asoma por el borde de un
 * contenedor. Solo dibuja el icono: quien lo usa lo mete en un contenedor con `overflow-hidden`, que
 * recorta la parte que debe quedar escondida, y le da tamaño y posición con `className`.
 *
 * Al aparecer se desliza una sola vez desde detrás del borde (animación `doc-peek` de index.css) y se
 * queda en `rest`: el desplazamiento final, por ejemplo "0px" (queda donde se posicionó) o "50%" (la
 * mitad de su alto baja y queda recortada).
 *
 * @param {{ className?: string, rest?: string }} props
 */
export default function DocumentPeek({ className = "", rest = "0px" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 112"
      className={`doc-peek block ${className}`}
      style={{ "--doc-rest": rest }}
    >
      <path
        d="M8 0H64L88 24V104A8 8 0 0 1 80 112H8A8 8 0 0 1 0 104V8A8 8 0 0 1 8 0Z"
        className="fill-gray-200 dark:fill-gray-800"
      />
      <path d="M64 0L88 24H72A8 8 0 0 1 64 16Z" className="fill-gray-300 dark:fill-gray-700" />
      <rect x="16" y="48" width="56" height="6" rx="3" className="fill-gray-300 dark:fill-gray-700" />
      <rect x="16" y="64" width="56" height="6" rx="3" className="fill-gray-300 dark:fill-gray-700" />
      <rect x="16" y="80" width="36" height="6" rx="3" className="fill-gray-300 dark:fill-gray-700" />
    </svg>
  );
}
