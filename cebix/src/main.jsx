import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ParcelsProvider } from "./context/ParcelsContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ParcelsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ParcelsProvider>
    </ThemeProvider>
  </StrictMode>
);
