import { RISK_COLORS } from "../../../utils/riskColors";

export const GLASS =
  "bg-black/65";

export const RISK_META = {
  green: { plural: "Rendimiento alto", label: "Rendimiento alto", color: RISK_COLORS.green },
  yellow: { plural: "Rendimiento medio", label: "Rendimiento medio", color: RISK_COLORS.yellow },
  red: { plural: "Rendimiento bajo", label: "Rendimiento bajo", color: RISK_COLORS.red },
};

export const riskColorOf = (parcel) => RISK_COLORS[parcel?.riskColor] ?? "#98A2B3";