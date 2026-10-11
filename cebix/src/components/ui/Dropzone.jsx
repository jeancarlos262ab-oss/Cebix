import { useState } from "react";

/**
 * Zona de arrastrar y soltar reutilizable. Solo se encarga del aspecto y del arrastre: quien la usa decide
 * qué hacer con los archivos (`onFiles`). Mismo redondeo que el resto de contenedores de la app
 * (rounded-2xl), sin relleno por defecto.
 *
 * @param {{
 *   onFiles: (files: File[]) => void,
 *   accept?: string,
 *   multiple?: boolean,
 *   disabled?: boolean,
 *   busy?: boolean,
 *   active?: boolean,            // hay un archivo ya elegido (resalta el borde)
 *   className?: string,
 *   children: React.ReactNode | ((state: { dragging: boolean }) => React.ReactNode),
 * }} props
 */
export default function Dropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  busy = false,
  active = false,
  className = "",
  children,
}) {
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || busy;

  const state = blocked
    ? "cursor-progress opacity-70"
    : dragging
    ? "border-accent-500 bg-gray-50 dark:bg-gray-900"
    : active
    ? "border-gray-400 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/60"
    : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900";

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!blocked) onFiles(Array.from(e.dataTransfer.files ?? []));
      }}
      className={[
        "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-accent-500 *:pointer-events-none",
        state,
        className,
      ].join(" ")}
    >
      {typeof children === "function" ? children({ dragging }) : children}
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={blocked}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}
