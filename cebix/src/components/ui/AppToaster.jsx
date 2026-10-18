import { useEffect } from "react";
import { Toaster } from "sonner";
import { preloadToastSounds } from "../../services/toast";
import { useTheme } from "../../context/ThemeContext";

export default function AppToaster() {
  const { resolvedTheme } = useTheme();
  useEffect(() => preloadToastSounds(), []);
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