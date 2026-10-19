import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export const LINE = "border-gray-200 dark:border-gray-800";
export const DIVIDE = "divide-gray-200 dark:divide-gray-800";
export const CHIP = "flex shrink-0 text-accent-600 dark:text-accent-400";

export function Reveal({ children, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function Card({ icon: Icon, title, description, action, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-2xl border ${LINE} ${className}`}>
      <header className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${LINE}`}>
        <div className="flex min-w-0 items-start gap-3">
          {Icon && <span className={`${CHIP} mt-0.5`}><Icon size={18} strokeWidth={1.6} /></span>}
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {description && <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Heading({ icon: Icon, eyebrow, title, large = false, bebas = false, sizeClass, children }) {
  return (
    <div>
      {(Icon || eyebrow) && (
        <div className="flex items-center gap-2">
          {Icon && <span className={CHIP}><Icon size={18} strokeWidth={1.6} /></span>}
          {eyebrow && <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{eyebrow}</p>}
        </div>
      )}
      <h2 className={`${Icon || eyebrow ? "mt-1" : ""} text-gray-900 dark:text-gray-100 ${bebas ? `font-bebas font-normal tracking-wide ${sizeClass ?? (large ? "text-3xl sm:text-5xl" : "text-2xl")}` : `font-display font-semibold ${large ? "text-2xl sm:text-3xl" : "text-xl"}`}`}>{title}</h2>
      {children && <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-500 dark:text-gray-400">{children}</p>}
    </div>
  );
}

export function Fact({ icon: Icon, label, wrap = false, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className={CHIP}><Icon size={22} strokeWidth={1.6} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`mt-0.5 font-display text-sm font-bold leading-tight text-gray-900 dark:text-white ${wrap ? "" : "sm:whitespace-nowrap"}`}>{children}</p>
      </div>
    </div>
  );
}

const FADE_LEFT = "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.03) 8%, rgba(0,0,0,0.12) 18%, rgba(0,0,0,0.28) 30%, rgba(0,0,0,0.5) 43%, rgba(0,0,0,0.74) 57%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,0.98) 85%, #000 100%)";
const FADE_DOWN = "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.98) 15%, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0.74) 40%, rgba(0,0,0,0.5) 53%, rgba(0,0,0,0.28) 66%, rgba(0,0,0,0.12) 78%, rgba(0,0,0,0.03) 90%, transparent 100%)";
export const HERO_MASK = {
  maskImage: `${FADE_LEFT}, ${FADE_DOWN}`,
  WebkitMaskImage: `${FADE_LEFT}, ${FADE_DOWN}`,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

const HERO_H = 420;
const HERO_CONTENT = 896;
const HERO_PAD = 32;
const HERO_MIN_W = 240;

export function useHeroSize(heroRef) {
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const root = hero?.parentElement;
    if (!hero || !root) return undefined;
    const xl = window.matchMedia("(min-width: 1280px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      const width = root.getBoundingClientRect().width;
      hero.style.height = xl.matches ? `${HERO_H}px` : "";
      if (lg.matches) {
        const left = HERO_PAD + Math.min(HERO_CONTENT, width - HERO_PAD * 2) / 2;
        hero.style.width = `${Math.round(Math.max(HERO_MIN_W, width - left))}px`;
      } else hero.style.width = "";
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    xl.addEventListener("change", measure);
    lg.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      xl.removeEventListener("change", measure);
      lg.removeEventListener("change", measure);
    };
  }, [heroRef]);
}

export const HeroPhoto = memo(function HeroPhoto({ src, alt = "", position = "center" }) {
  const ref = useRef(null);
  const boxRef = useRef(null);
  useHeroSize(boxRef);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);
  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute right-0 top-0 -z-10 h-80 w-full transform-gpu opacity-30 [contain:paint] lg:w-[45%] lg:opacity-100"
      style={HERO_MASK}
    >
      <img
        ref={ref}
        src={src}
        alt={alt}
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`size-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ objectPosition: position }}
      />
    </div>
  );
});