import { useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./auth.css";

/**
 * Campo de formulario de Login/Signup. Un solo color (cebada): el icono es
 * neutro y se oscurece al enfocar; el foco lo marca solo el borde en tinta
 * (sin anillo ni brillo). Ver auth.css.
 *
 * @param {{
 *   label: string,
 *   icon?: React.ElementType,
 *   rightElement?: React.ReactNode,
 *   hint?: string,
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export default function AuthField({ label, icon: Icon, rightElement, hint, className = "", id, ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="auth-field">
      <label htmlFor={inputId} className="auth-label">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="auth-input-icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          />
        )}
        <input
          {...inputProps}
          id={inputId}
          aria-describedby={hintId}
          className={["auth-input", Icon ? "pl-11" : "pl-5", rightElement ? "pr-12" : "pr-5", className].join(" ")}
        />
        {rightElement && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {hint && (
        <p id={hintId} role="status" className="auth-hint pl-4">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Botón de mostrar/ocultar contraseña para el `rightElement` de AuthField. */
export function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      className="auth-icon-btn"
    >
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}
