import { useEffect } from "react";
import { useDesignerStore } from "../store/desingerStore";

/**
 * Hook para manejar atajos de teclado globales
 */
export const useKeyboardShortcuts = () => {
  const {
    selectedElementId,
    deleteElement,
    duplicateElement,
    toggleGrid,
    saveProject,
  } = useDesignerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si está en un input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Delete/Backspace - Eliminar elemento seleccionado
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
        e.preventDefault();
        deleteElement(selectedElementId);
      }

      // Ctrl/Cmd + D - Duplicar elemento
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedElementId) {
        e.preventDefault();
        duplicateElement(selectedElementId);
      }

      // Ctrl/Cmd + G - Toggle grid
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        toggleGrid();
      }

      // Ctrl/Cmd + S - Guardar proyecto
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const name = prompt("Nombre del proyecto:");
        if (name) {
          saveProject(name);
        }
      }

      // Escape - Deseleccionar
      if (e.key === "Escape" && selectedElementId) {
        useDesignerStore.getState().selectElement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedElementId,
    deleteElement,
    duplicateElement,
    toggleGrid,
    saveProject,
  ]);
};
