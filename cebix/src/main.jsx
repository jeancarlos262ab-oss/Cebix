import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { loadFonts } from "./utils/loadFonts.js";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { ModelInfoProvider } from "./context/ModelInfoContext.jsx";
import { ParcelsProvider } from "./context/ParcelsContext.jsx";
import AppToaster from "./components/ui/AppToaster.jsx";

loadFonts();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ModelInfoProvider>
          <ParcelsProvider>
            <PreferencesProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
              </BrowserRouter>
            </PreferencesProvider>
            <AppToaster />
          </ParcelsProvider>
        </ModelInfoProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
