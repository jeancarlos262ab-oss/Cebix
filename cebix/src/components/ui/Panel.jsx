/**
 * Contenedor de sección: borde, fondo y sombra de tarjeta. Sustituye a las
 * líneas divisorias entre secciones; el espacio entre contenedores lo da el
 * `gap` del grid o el `space-y` del padre.
 *
 * @param {{ as?: React.ElementType, className?: string, children: React.ReactNode }} props
 */
export default function Panel({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag
      className={`relative rounded-2xl border border-gray-200 bg-white p-5 shadow-card dark:border-gray-800 dark:bg-black ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
