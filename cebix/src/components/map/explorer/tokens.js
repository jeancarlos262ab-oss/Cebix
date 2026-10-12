import { RISK_COLORS } from "../../../utils/riskColors";

/** Cristal oscuro flotante sobre el mapa (el mapa satelital siempre es oscuro, en cualquier tema). */
export const GLASS =
  "bg-black/65";

export const RISK_META = {
  green: { plural: "Elegibles", label: "Elegible", color: RISK_COLORS.green },
  yellow: { plural: "Revisión", label: "Revisión", color: RISK_COLORS.yellow },
  red: { plural: "Alto riesgo", label: "Alto riesgo", color: RISK_COLORS.red },
};

export const riskColorOf = (parcel) => RISK_COLORS[parcel?.riskColor] ?? "#98A2B3";

