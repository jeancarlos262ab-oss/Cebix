import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { ModelInfoProvider } from "./context/ModelInfoContext.jsx";
import { ParcelsProvider } from "./context/ParcelsContext.jsx";
import AppToaster from "./components/ui/AppToaster.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ModelInfoProvider>
          <ParcelsProvider>
            <PreferencesProvider>
              <BrowserRouter>
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
