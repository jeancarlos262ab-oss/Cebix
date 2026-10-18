import { memo } from "react";

const SIZES = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
  hero: "text-5xl xl:text-6xl",
  
  display: "text-6xl lg:text-7xl xl:text-8xl",
};

const W0 = 697;
const H0 = 509;
const RATIO = W0 / H0; 

const MARK_H = 0.7;
const MARK_H_WITH_TEXT = 1.05;

const MARK_PATH = [
  
  "M16 0H206L453 253L195 508H0L258 253Z",
  "M689 0H501L377 122L471 222Z",
  "M374 374L501 508H696L471 283Z",
].join("");

function LogoMark({ height = MARK_H }) {
  return (
    <svg
      viewBox={`0 0 ${W0} ${H0}`}
      aria-hidden="true"
      className="block shrink-0"
      style={{ width: `${height * RATIO}em`, height: `${height}em` }}
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

function Logo({ className = "", size = "md", tone = "auto", showText = true }) {
  let toneClass = "text-gray-900 dark:text-white";
  if (tone === "contrast") toneClass = "text-(--accent-contrast)";
  if (tone === "inherit") toneClass = "";
  
  if (tone === "white") toneClass = "text-white!";

  return (
    <span
      role="img"
      aria-label="CEBIX"
      className={`inline-flex select-none items-center gap-[0.32em] leading-none transition-colors duration-300 ease-out ${toneClass} ${SIZES[size]} ${className}`}
    >
      <LogoMark height={showText ? MARK_H_WITH_TEXT : MARK_H} />
      {showText && (
        <span
          aria-hidden="true"
          className="font-garet font-extrabold uppercase leading-none tracking-tight"
        >
          CEBIX
        </span>
      )}
    </span>
  );
}

export default memo(Logo);