const STEPS = 16;

const FADE_COLOR = "var(--page-bg, #000)";

const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function softFadeGradient(direction, start, length, strength = 1) {
  const stops = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const opacity = Math.round((1 - smootherstep(t)) * strength * 1000) / 10; 
    const pos = `calc(${start} + ${length} * ${t.toFixed(4)})`;
    stops.push(
      opacity >= 100
        ? `${FADE_COLOR} ${pos}`
        : opacity <= 0
          ? `transparent ${pos}`
          : `color-mix(in srgb, ${FADE_COLOR} ${opacity}%, transparent) ${pos}`
    );
  }
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

export const LEFT_FADE_LENGTH = "12rem";