import { Loader2, ArrowRight } from "lucide-react";
import "./auth.css";

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