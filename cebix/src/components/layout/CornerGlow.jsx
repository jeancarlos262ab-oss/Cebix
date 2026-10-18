export default function CornerGlow({ className = "" }) {
  return <div aria-hidden="true" className={`app-corner-glow pointer-events-none absolute inset-0 ${className}`} />;
}