import {
  LayoutGrid,
  MapPin,
  BrainCircuit,
  Satellite,
  BarChart3,
  ShieldCheck,
  Globe,
  BookOpen,
} from "lucide-react";

export const generalNav = [
  { label: "Resumen", icon: LayoutGrid, to: "/" },
  { label: "Parcelas", icon: MapPin, to: "/parcelas" },
  { label: "Modelo", icon: BrainCircuit, to: "/modelo" },
  { label: "Mapa satelital", icon: Satellite, to: "/mapa" },
  { label: "Cebada y FIRA", icon: BookOpen, to: "/acerca" },
];

export const workspaceNav = [
  { label: "Predicciones", icon: BarChart3, to: "/predicciones" },
  { label: "Parcela satelital", icon: Globe, to: "/satelite" },
  { label: "Validación SHAP", icon: ShieldCheck, to: "/shap" },
];

