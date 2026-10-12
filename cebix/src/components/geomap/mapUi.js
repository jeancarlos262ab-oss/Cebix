/**
 * Estilo común de lo que flota sobre el mapa (globo y mapa plano).
 * Sobrio a propósito: paneles planos y oscuros, esquinas poco redondeadas, sin sombras ni desenfoque.
 * La acción principal va en blanco sólido; no usa el color de acento para no competir con la imagen.
 */
export const PANEL = "rounded-lg border border-white/15 bg-black/90";

const TOOL_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const PRIMARY = `${TOOL_BTN} bg-white text-gray-900 hover:bg-gray-200`;
export const GHOST = `${TOOL_BTN} text-gray-200 hover:bg-white/10`;

export const STATUS = `${PANEL} inline-block max-w-full px-3 py-1.5 text-xs text-gray-300`;
