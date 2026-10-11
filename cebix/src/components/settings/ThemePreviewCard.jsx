import { Check } from "lucide-react";

/**
 * Mini maqueta de la interfaz (sidebar + topbar + tarjetas + gráficas + tabla) usada como
 * previsualización de un tema. El viewBox mantiene una proporción fija (240×100) y el
 * contenedor la respeta, así que nunca se estira: en celular la tarjeta ocupa todo el ancho
 * y la maqueta crece con ella, rellenándose con más elementos.
 *
 * @param {{variant: "light" | "dark" | "split", accentColor: string}} props
 */
function MiniMockup({ variant, accentColor }) {
  const isDark = variant === "dark";
  const canvasBg = isDark ? "#0A0A0A" : "#F4F6FA";
  const sidebarBg = isDark ? "#000000" : "#FFFFFF";
  const cardBg = isDark ? "#171717" : "#FFFFFF";
  const lineStrong = isDark ? "#404040" : "#E1E6EF";
  const lineSoft = isDark ? "#262626" : "#EEF1F6";
  const textStrong = isDark ? "#A3A3A3" : "#9AA3B2";
  const green = "#4C9A63";
  const amber = "#D9A544";
  const red = "#D4574E";

  const body = (
    <svg viewBox="0 0 240 100" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="240" height="100" fill={canvasBg} />

      {/* sidebar */}
      <rect x="0" y="0" width="52" height="100" fill={sidebarBg} />
      <circle cx="13" cy="12" r="4" fill={accentColor} />
      <rect x="21" y="10" width="20" height="4" rx="2" fill={textStrong} />
      <rect x="6" y="26" width="40" height="8" rx="2" fill={lineSoft} />
      <rect x="10" y="28.5" width="3" height="3" rx="1.5" fill={accentColor} />
      <rect x="17" y="29" width="22" height="2.5" rx="1.25" fill={textStrong} />
      {[42, 54, 66, 78].map((y, i) => (
        <g key={y}>
          <rect x="10" y={y + 0.5} width="3" height="3" rx="1.5" fill={lineStrong} />
          <rect x="17" y={y + 1} width={[18, 24, 16, 20][i]} height="2.5" rx="1.25" fill={lineStrong} />
        </g>
      ))}
      <circle cx="12" cy="91" r="4" fill={lineStrong} />
      <rect x="20" y="88.5" width="18" height="2.5" rx="1.25" fill={lineStrong} />
      <rect x="20" y="93" width="12" height="2" rx="1" fill={lineSoft} />

      {/* topbar */}
      <rect x="62" y="9" width="46" height="5" rx="2.5" fill={textStrong} />
      <rect x="62" y="17" width="70" height="3" rx="1.5" fill={lineStrong} />
      <rect x="182" y="8" width="38" height="11" rx="5.5" fill={cardBg} />
      <rect x="188" y="12.5" width="16" height="2.5" rx="1.25" fill={lineStrong} />
      <circle cx="228" cy="13.5" r="5" fill={accentColor} />

      {/* tarjetas de métricas */}
      {[
        [62, green],
        [112, amber],
        [162, red],
      ].map(([x, dot], i) => (
        <g key={x}>
          <rect x={x} y="27" width="46" height="23" rx="4" fill={cardBg} />
          <circle cx={x + 8} cy="34" r="2.5" fill={dot} />
          <rect x={x + 14} y="32.5" width="18" height="3" rx="1.5" fill={lineStrong} />
          <rect x={x + 7} y="40" width={[22, 18, 14][i]} height="5" rx="2" fill={textStrong} />
        </g>
      ))}
      <rect x="212" y="27" width="20" height="23" rx="4" fill={cardBg} />
      <circle cx="222" cy="38.5" r="6" fill="none" stroke={lineStrong} strokeWidth="3" />
      <path d="M222 32.5 A6 6 0 0 1 228 38.5" fill="none" stroke={accentColor} strokeWidth="3" />

      {/* gráfica de línea */}
      <rect x="62" y="57" width="88" height="37" rx="4" fill={cardBg} />
      <rect x="68" y="62" width="22" height="3" rx="1.5" fill={textStrong} />
      {[72, 79, 86].map((y) => (
        <line key={y} x1="68" x2="144" y1={y} y2={y} stroke={lineSoft} />
      ))}
      <polyline
        points="68,86 76,79 84,83 92,74 100,78 108,70 116,75 124,66 132,70 143,62"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* barras */}
      <rect x="156" y="57" width="34" height="37" rx="4" fill={cardBg} />
      {[8, 14, 10, 18, 13].map((h, i) => (
        <rect
          key={i}
          x={161 + i * 6}
          y={88 - h}
          width="4"
          height={h}
          rx="1"
          fill={i === 3 ? accentColor : lineStrong}
        />
      ))}

      {/* tabla */}
      <rect x="196" y="57" width="36" height="37" rx="4" fill={cardBg} />
      {[63, 71, 79, 87].map((y, i) => (
        <g key={y}>
          <circle cx="202" cy={y + 1.5} r="1.75" fill={[green, amber, green, red][i]} />
          <rect x="207" y={y} width={[16, 12, 18, 10][i]} height="3" rx="1.5" fill={lineStrong} />
        </g>
      ))}
    </svg>
  );

  if (variant !== "split") return body;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <MiniMockup variant="light" accentColor={accentColor} />
      </div>
      <div className="absolute inset-0" style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}>
        <MiniMockup variant="dark" accentColor={accentColor} />
      </div>
    </div>
  );
}

/**
 * Tarjeta seleccionable de tema. Al seleccionarla NO cambia el contorno: se pinta con el
 * color de acento el fondo del recuadro que contiene los textos.
 *
 * @param {{label: string, description?: string, variant: "light"|"dark"|"split", active: boolean, onSelect: () => void, accentColor?: string}} props
 */
export default function ThemePreviewCard({ label, description, variant, active, onSelect, accentColor = "#C08A2E" }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group relative block w-full overflow-hidden rounded-none border-0 bg-white text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 dark:bg-gray-800"
    >
      <div className="aspect-[12/5] w-full overflow-hidden">
        <MiniMockup variant={variant} accentColor={accentColor} />
      </div>
      <div
        className={[
          "flex items-center justify-between gap-2 px-3.5 py-3 transition-colors",
          active
            ? "bg-accent-500 text-accent-contrast"
            : "bg-gray-50 text-gray-900 group-hover:bg-gray-100 dark:bg-gray-900 dark:text-white dark:group-hover:bg-gray-700/60",
        ].join(" ")}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          {description && (
            <span
              className={[
                "block text-xs",
                active ? "text-accent-contrast/80" : "text-gray-500 dark:text-gray-400",
              ].join(" ")}
            >
              {description}
            </span>
          )}
        </span>
        <span
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            active
              ? "border-accent-contrast/70 bg-accent-contrast/20 text-accent-contrast"
              : "border-gray-300 text-transparent dark:border-gray-600",
          ].join(" ")}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}
