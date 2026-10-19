import { Check } from "lucide-react";

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

  const body = (
    <svg viewBox="0 0 240 100" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="240" height="100" fill={canvasBg} />

      {}
      <rect x="3" y="3" width="50" height="94" rx="4" fill={sidebarBg} stroke={lineSoft} strokeWidth="0.75" />

      {}
      <circle cx="11" cy="8.5" r="2.6" fill={accentColor} />
      <rect x="16" y="7.2" width="16" height="2.6" rx="1.3" fill={textStrong} />
      {[6.8, 8.5, 10.2].map((y) => (
        <line key={y} x1="43" x2="48" y1={y} y2={y} stroke={lineStrong} strokeWidth="0.8" strokeLinecap="round" />
      ))}
      <line x1="3.4" x2="52.6" y1="14" y2="14" stroke={lineSoft} strokeWidth="0.75" />

      {}
      <rect x="8" y="18" width="12" height="1.5" rx="0.75" fill={lineStrong} />
      <rect x="3.4" y="21" width="49.2" height="4" fill={lineSoft} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect
            x="8"
            y={22.1 + i * 4.2}
            width="2"
            height="2"
            rx="0.6"
            fill="none"
            stroke={i === 0 ? textStrong : lineStrong}
            strokeWidth={i === 0 ? 0.9 : 0.7}
          />
          <rect
            x="12.5"
            y={22.4 + i * 4.2}
            width={[11, 10, 9, 17, 9][i]}
            height="1.5"
            rx="0.75"
            fill={i === 0 ? textStrong : lineStrong}
          />
        </g>
      ))}

      {}
      <rect x="8" y="44.5" width="12" height="1.5" rx="0.75" fill={lineStrong} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="8" y={47.6 + i * 4.2} width="2" height="2" rx="0.6" fill="none" stroke={lineStrong} strokeWidth="0.7" />
          <rect x="12.5" y={47.9 + i * 4.2} width={[14, 15, 16][i]} height="1.5" rx="0.75" fill={lineStrong} />
        </g>
      ))}

      {}
      <rect x="8" y="62" width="15" height="1.5" rx="0.75" fill={lineStrong} />
      <rect x="8" y="65.1" width="2" height="2" rx="0.6" fill="none" stroke={lineStrong} strokeWidth="0.7" />
      <rect x="12.5" y="65.4" width="9" height="1.5" rx="0.75" fill={lineStrong} />

      {}
      <line x1="3.4" x2="52.6" y1="77" y2="77" stroke={lineSoft} strokeWidth="0.75" />
      <circle cx="12" cy="83" r="3.4" fill={lineStrong} />
      <circle cx="14.6" cy="85.6" r="1" fill={green} stroke={sidebarBg} strokeWidth="0.5" />
      <rect x="18.5" y="82" width="15" height="2" rx="1" fill={textStrong} />
      <polyline points="46.5,81.5 48,83 46.5,84.5" fill="none" stroke={lineStrong} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="90.1" width="2" height="2" rx="0.6" fill="none" stroke={lineStrong} strokeWidth="0.7" />
      <rect x="12.5" y="90.4" width="16" height="1.5" rx="0.75" fill={lineStrong} />

      {}
      <rect x="60" y="8" width="52" height="4.5" rx="2.25" fill={textStrong} />
      <rect x="60" y="15" width="84" height="2.5" rx="1.25" fill={lineStrong} />
      <circle cx="226" cy="12" r="4.5" fill={accentColor} />

      {}
      <rect x="60" y="25" width="30" height="3.5" rx="1.75" fill={textStrong} />
      <rect x="60" y="31" width="22" height="2" rx="1" fill={lineStrong} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={60 + i * 12} y="37" width="9" height="2.5" rx="1.25" fill={i === 0 ? textStrong : lineStrong} />
      ))}
      <line x1="60" x2="106" y1="42.5" y2="42.5" stroke={lineSoft} strokeWidth="1" />
      <rect x="60" y="41.75" width="9" height="1.5" rx="0.75" fill={accentColor} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="60" y={47 + i * 8} width={[22, 26, 20][i]} height="2.2" rx="1.1" fill={lineStrong} />
          <rect x="94" y={46.6 + i * 8} width="12" height="3" rx="1.5" fill={textStrong} />
          <line x1="60" x2="106" y1={52 + i * 8} y2={52 + i * 8} stroke={lineSoft} strokeWidth="0.75" />
        </g>
      ))}

      {}
      <rect x="60" y="72" width="32" height="3.5" rx="1.75" fill={textStrong} />
      <rect x="98" y="70.5" width="8" height="8" rx="2" fill="none" stroke={lineStrong} strokeWidth="0.75" />
      {[10, 14, 8, 12, 9].map((h, i) => (
        <g key={i}>
          <rect x={61 + i * 9} y={96 - h - 4} width="3" height={h + 4} fill={lineSoft} />
          <rect x={64.5 + i * 9} y={96 - h} width="3" height={h} fill={accentColor} />
        </g>
      ))}

      {}
      <rect x="116" y="25" width="50" height="3.5" rx="1.75" fill={textStrong} />
      <rect x="116" y="31" width="66" height="2" rx="1" fill={lineStrong} />
      <rect x="222" y="24" width="10" height="10" rx="2.5" fill="none" stroke={lineStrong} strokeWidth="0.75" />
      {[41, 48, 55, 62].map((y) => (
        <line key={y} x1="116" x2="232" y1={y} y2={y} stroke={lineSoft} strokeWidth="0.75" />
      ))}
      <path
        d="M116 62 C124 61 130 58 138 52 C146 46 150 43 158 44 C168 45 172 52 182 55 C192 58 200 60 210 61 C218 61.5 226 62 232 62 L232 62 L116 62 Z"
        fill={accentColor}
        fillOpacity="0.18"
      />
      <path
        d="M116 62 C124 61 130 58 138 52 C146 46 150 43 158 44 C168 45 172 52 182 55 C192 58 200 60 210 61 C218 61.5 226 62 232 62"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {[122, 140, 158, 176, 194, 212].map((x) => (
        <rect key={x} x={x} y="64" width="8" height="2" rx="1" fill={lineStrong} />
      ))}

      {}
      <rect x="116" y="71" width="36" height="3.5" rx="1.75" fill={textStrong} />
      <rect x="186" y="69" width="22" height="7" rx="2" fill="none" stroke={lineStrong} strokeWidth="0.75" />
      <rect x="211" y="69" width="21" height="7" rx="2" fill={accentColor} />
      <rect x="116" y="79" width="116" height="24" rx="3" fill="none" stroke={lineStrong} strokeWidth="0.75" />
      <line x1="116" x2="232" y1="84.5" y2="84.5" stroke={lineStrong} strokeWidth="0.75" />
      {[122, 148, 172, 190, 208].map((x, i) => (
        <rect key={x} x={x} y="81.2" width={[14, 14, 8, 8, 12][i]} height="1.8" rx="0.9" fill={lineStrong} />
      ))}
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x="122" y={87.5 + i * 6} width="16" height="2.2" rx="1.1" fill={textStrong} />
          <rect x="148" y={87.5 + i * 6} width="12" height="2.2" rx="1.1" fill={lineStrong} />
          <circle cx="174" cy={88.6 + i * 6} r="1.8" fill={[green, amber][i]} />
          <rect x="190" y={87.5 + i * 6} width="8" height="2.2" rx="1.1" fill={lineStrong} />
          <rect x="208" y={87.5 + i * 6} width="14" height="2.2" rx="1.1" fill={lineStrong} />
          <line x1="116" x2="232" y1={91.5 + i * 6} y2={91.5 + i * 6} stroke={lineSoft} strokeWidth="0.75" />
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

export default function ThemePreviewCard({ label, description, variant, active, onSelect, accentColor = "#C08A2E" }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group block w-full text-left focus:outline-hidden"
    >
      <div className="relative">
        <div
          className={[
            "aspect-[12/5] w-full overflow-hidden rounded-xl border-2 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-white dark:group-focus-visible:ring-offset-black",
            active
              ? "border-accent-500"
              : "border-gray-200 group-hover:border-gray-300 dark:border-gray-800 dark:group-hover:border-gray-600",
          ].join(" ")}
        >
          <MiniMockup variant={variant} accentColor={accentColor} />
        </div>
        <span
          className={[
            "absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-accent-500 text-accent-contrast shadow-sm transition-[opacity,transform] duration-200 dark:border-black",
            active ? "scale-100 opacity-100" : "scale-75 opacity-0",
          ].join(" ")}
          aria-hidden="true"
        >
          <Check size={13} strokeWidth={3} />
        </span>
      </div>
      <div className="mt-3 text-center">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
        {description && <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
      </div>
    </button>
  );
}