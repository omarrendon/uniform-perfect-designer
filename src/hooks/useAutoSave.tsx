import { useEffect } from "react";
import { useDesignerStore } from "../store/desingerStore";

/**
 * Hook para auto-guardar el proyecto en localStorage
 */
export const useAutoSave = (intervalMs: number = 30000) => {
  const { elements, canvasConfig, sizeConfigs } = useDesignerStore();

  useEffect(() => {
    const autoSave = () => {
      const autoSaveData = {
        elements,
        canvasConfig,
        sizeConfigs,
        timestamp: new Date().toISOString(),
      };

      try {
        localStorage.setItem(
          "uniform-designer-autosave",
          JSON.stringify(autoSaveData)
        );
        console.log("Auto-guardado realizado");
      } catch (error) {
        console.error("Error en auto-guardado:", error);
      }
    };

    // Auto-guardar cada X segundos
    const interval = setInterval(autoSave, intervalMs);

    return () => clearInterval(interval);
  }, [elements, canvasConfig, sizeConfigs, intervalMs]);

  // Función para recuperar auto-guardado
  const restoreAutoSave = () => {
    try {
      const saved = localStorage.getItem("uniform-designer-autosave");
      if (saved) {
        const data = JSON.parse(saved);
        return data;
      }
    } catch (error) {
      console.error("Error al recuperar auto-guardado:", error);
    }
    return null;
  };

  return { restoreAutoSave };
};
