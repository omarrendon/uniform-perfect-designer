import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initializeCustomFonts } from "./utils/fontLoader";

// Inicializar el sistema de fuentes personalizadas
initializeCustomFonts();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
