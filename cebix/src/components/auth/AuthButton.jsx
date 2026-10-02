import { Loader2, ArrowRight } from "lucide-react";
import "./auth.css";

/**
 * Botón primario de Login/Signup: relleno cebada con texto en tinta
 * (contraste 7:1), esquinas rectas como el resto de la app.
 *
 * @param {{
 *   loading?: boolean,
 *   loadingLabel?: string,
 *   arrow?: boolean,
 *   children: React.ReactNode,
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export default function AuthButton({ loading = false, loadingLabel, arrow = true, disabled, children, ...rest }) {
  return (
    <button type="submit" disabled={disabled || loading} className="auth-btn" {...rest}>
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        <>
          {children}
          {arrow && <ArrowRight size={16} className="auth-btn-arrow" aria-hidden="true" />}
        </>
      )}
    </button>
  );
}
