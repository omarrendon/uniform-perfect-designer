import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initializeCustomFonts, hydrateUserFonts } from "./utils/fontLoader";
import { useDesignerStore } from "./store/desingerStore";

// Inicializar el sistema de fuentes personalizadas (estáticas)
initializeCustomFonts();

// Hidratar fuentes subidas por el usuario desde localStorage
const { userFonts } = useDesignerStore.getState();
if (userFonts.length > 0) {
  hydrateUserFonts(userFonts);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
