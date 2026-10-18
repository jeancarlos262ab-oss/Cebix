export const SELECTED_SHAPE_SIZE = 30;

export function selectedShapeSvg(color, size = SELECTED_SHAPE_SIZE) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 30 30" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5))" aria-hidden="true"><polygon points="15,2 28,15 15,28 2,15" fill="${color}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><circle cx="15" cy="15" r="3.5" fill="#ffffff"/></svg>`;
}