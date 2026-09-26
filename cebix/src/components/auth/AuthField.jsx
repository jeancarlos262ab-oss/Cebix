/**
 * Campo de formulario con icono a la izquierda, usado en Login/Signup.
 * Mantiene los mismos tokens de color y foco que el resto de la app
 * (border-gray-300/700, focus:ring-accent-100/700).
 *
 * @param {{
 *   label: string,
 *   icon: React.ElementType,
 *   rightElement?: React.ReactNode,
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export default function AuthField({ label, icon: Icon, rightElement, className = "", ...inputProps }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
        )}
        <input
          {...inputProps}
          className={[
            "w-full border border-gray-300 bg-white py-2.5 text-sm text-gray-900 outline-none transition",
            "focus:border-accent-500 focus:ring-2 focus:ring-accent-100",
            "dark:border-gray-700 dark:bg-black dark:text-white dark:focus:ring-accent-700",
            Icon ? "pl-10" : "pl-3",
            rightElement ? "pr-10" : "pr-3",
            className,
          ].join(" ")}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </label>
  );
}
