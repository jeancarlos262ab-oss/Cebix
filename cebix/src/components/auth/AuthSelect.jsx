import { useId } from "react";
import { ChevronDown } from "lucide-react";
import "./auth.css";

/**
 * Selector con el mismo aspecto que AuthField (se usa en el registro para
 * región y rol).
 *
 * @param {{
 *   label: string,
 *   icon?: React.ElementType,
 *   options: string[],
 * } & React.SelectHTMLAttributes<HTMLSelectElement>} props
 */
export default function AuthSelect({ label, icon: Icon, options, id, className = "", ...selectProps }) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="auth-field">
      <label htmlFor={selectId} className="auth-label">
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
        <select
          {...selectProps}
          id={selectId}
          className={["auth-input", Icon ? "pl-11" : "pl-5", "pr-10", className].join(" ")}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="auth-input-icon pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}
