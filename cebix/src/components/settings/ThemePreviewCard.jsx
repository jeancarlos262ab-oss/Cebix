import { Check } from "lucide-react";

/**
 * Mini maqueta de la interfaz (sidebar + contenido + tarjetas) usada como
 * previsualización dentro de una tarjeta seleccionable de tema.
 *
 * @param {{variant: "light" | "dark" | "split", accentColor: string}} props
 */
function MiniMockup({ variant, accentColor }) {
  const isDark = variant === "dark";
  const canvasBg = isDark ? "#0A0A0A" : "#F4F6FA";
  const sidebarBg = isDark ? "#000000" : "#FFFFFF";
  const cardBg = isDark ? "#171717" : "#FFFFFF";
  const lineStrong = isDark ? "#404040" : "#E7EBF2";
  const lineSoft = isDark ? "#262626" : "#F1F3F7";

  const body = (
    <svg viewBox="0 0 160 104" className="h-full w-full" preserveAspectRatio="none">
      <rect x="0" y="0" width="160" height="104" fill={canvasBg} />
      {/* sidebar */}
      <rect x="0" y="0" width="42" height="104" fill={sidebarBg} />
      <rect x="10" y="12" width="22" height="6" rx="3" fill={accentColor} />
      <rect x="10" y="30" width="24" height="4" rx="2" fill={lineStrong} />
      <rect x="10" y="40" width="18" height="4" rx="2" fill={lineSoft} />
      <rect x="10" y="50" width="20" height="4" rx="2" fill={lineSoft} />
      {/* topbar */}
      <rect x="52" y="10" width="46" height="6" rx="3" fill={lineStrong} />
      <rect x="118" y="8" width="32" height="10" rx="5" fill={cardBg} stroke={lineStrong} />
      {/* cards */}
      <rect x="52" y="28" width="42" height="26" rx="4" fill={cardBg} stroke={lineStrong} strokeWidth="1" />
      <rect x="98" y="28" width="52" height="26" rx="4" fill={cardBg} stroke={lineStrong} strokeWidth="1" />
      <rect x="58" y="35" width="20" height="4" rx="2" fill={lineSoft} />
      <rect x="58" y="43" width="14" height="5" rx="2" fill="#4C9A63" />
      <rect x="52" y="62" width="98" height="34" rx="4" fill={cardBg} stroke={lineStrong} strokeWidth="1" />
      <polyline
        points="58,88 68,78 78,84 88,70 98,76 108,64 118,72 128,60 138,68"
        fill="none"
        stroke={accentColor}
        strokeWidth="2"
      />
    </svg>
  );

  if (variant !== "split") return body;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <MiniMockup variant="light" accentColor={accentColor} />
      </div>
      <div
        className="absolute inset-0"
        style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
      >
        <MiniMockup variant="dark" accentColor={accentColor} />
      </div>
    </div>
  );
}

/**
 * @param {{label: string, description?: string, variant: "light"|"dark"|"split", active: boolean, onSelect: () => void, accentColor?: string}} props
 */
export default function ThemePreviewCard({ label, description, variant, active, onSelect, accentColor = "#C08A2E" }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={[
        "group relative w-full overflow-hidden border bg-white text-left transition-all dark:bg-gray-800",
        active
          ? "border-accent-500 ring-2 ring-accent-100 dark:ring-accent-500/20"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
      ].join(" ")}
    >
      <div className="h-24 w-full border-b border-gray-100 dark:border-gray-700">
        <MiniMockup variant={variant} accentColor={accentColor} />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </span>
          {description && (
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {description}
            </span>
          )}
        </span>
        <span
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center border",
            active
              ? "border-accent-500 bg-accent-500 text-white"
              : "border-gray-300 text-transparent dark:border-gray-600",
          ].join(" ")}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}
