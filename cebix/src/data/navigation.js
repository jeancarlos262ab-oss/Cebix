import {
  LayoutGrid,
  MapPin,
  BrainCircuit,
  Satellite,
  BarChart3,
  ShieldCheck,
  Users,
} from "lucide-react";

export const generalNav = [
  { label: "Dashboard", icon: LayoutGrid, to: "/" },
  { label: "Parcelas", icon: MapPin, to: "/parcelas" },
  { label: "Modelo", icon: BrainCircuit, to: "/modelo" },
  { label: "Mapa satelital", icon: Satellite, to: "/mapa" },
];

export const workspaceNav = [
  { label: "Predicciones", icon: BarChart3, to: "/predicciones" },
  { label: "Validación SHAP", icon: ShieldCheck, to: "/shap" },
  { label: "Usuarios", icon: Users, to: "/usuarios" },
];

export const regions = [
  { label: "Hidalgo", shortcut: "⌘1", color: "#374151" },
  { label: "Tlaxcala", shortcut: "⌘2", color: "#C08A2E" },
  { label: "Puebla", shortcut: "⌘3", color: "#4C9A63" },
  { label: "Nacional", shortcut: "⌘4", color: "#98A2B3" },
];
