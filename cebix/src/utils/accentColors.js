/**
 * Color de acento como valor hex, para librerías que no entienden variables
 * CSS (MapLibre, Leaflet). Debe coincidir con --accent-500 de index.css.
 *
 * @param {"brand"|"ndvi"|"mono"} accent
 * @param {"light"|"dark"} resolvedTheme
 */
const ACCENT_500 = {
  brand: { light: "#C08A2E", dark: "#C08A2E" },
  ndvi: { light: "#4C9A63", dark: "#4C9A63" },
  mono: { light: "#1F2937", dark: "#FFFFFF" },
};

export function getAccentHex(accent, resolvedTheme) {
  const entry = ACCENT_500[accent] ?? ACCENT_500.brand;
  return resolvedTheme === "dark" ? entry.dark : entry.light;
}
