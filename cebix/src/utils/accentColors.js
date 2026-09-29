/**
 * Color de acento como valor hex, para librerías que no entienden variables
 * CSS (MapLibre, Leaflet). Debe coincidir con --accent-500 de index.css.
 *
 * @param {"brand"|"cobre"|"oliva"|"pizarra"|"ndvi"|"mono"} accent
 * @param {"light"|"dark"} resolvedTheme
 */
const ACCENT_500 = {
  brand: { light: "#C08A2E", dark: "#C08A2E" },
  cobre: { light: "#B76637", dark: "#B76637" },
  oliva: { light: "#949F4F", dark: "#949F4F" },
  pizarra: { light: "#4A71A4", dark: "#4A71A4" },
  ndvi: { light: "#4C9A63", dark: "#4C9A63" },
  mono: { light: "#1F2937", dark: "#FFFFFF" },
};

export function getAccentHex(accent, resolvedTheme) {
  const entry = ACCENT_500[accent] ?? ACCENT_500.brand;
  return resolvedTheme === "dark" ? entry.dark : entry.light;
}
