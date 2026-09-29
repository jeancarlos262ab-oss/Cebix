import { Toaster } from "sonner";
import { useTheme } from "../../context/ThemeContext";

/**
 * Único punto de montaje de las notificaciones (sonner). Aparecen abajo a la
 * derecha, en un color sólido según el contexto (éxito, error, aviso, info),
 * con los mismos tonos que usa el resto de la app y esquinas cuadradas.
 * Los colores viven en index.css (.app-toaster).
 * Uso en cualquier parte: `import { toast } from "sonner"; toast.success("...")`.
 */
export default function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      duration={4500}
      className="app-toaster"
      toastOptions={{
        style: { borderRadius: 0, fontSize: "0.875rem" },
      }}
    />
  );
}
