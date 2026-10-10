/** Cifra grande con los decimales atenuados (78.3 → "78" + ".3" en gris), como en los tableros de referencia. */
export default function BigNumber({ value, decimals = 1, unit, className = "text-4xl", unitClassName = "text-xs" }) {
  if (!Number.isFinite(value)) {
    return <span className={`font-thin leading-none text-white/40 ${className}`}>—</span>;
  }
  const [int, dec] = value.toFixed(decimals).split(".");
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-thin leading-none tracking-tight tabular-nums text-white ${className}`}>
        {int}
        {dec !== undefined && <span className="text-white/35">.{dec}</span>}
      </span>
      {unit && <span className={`font-normal text-white/45 ${unitClassName}`}>{unit}</span>}
    </span>
  );
}
