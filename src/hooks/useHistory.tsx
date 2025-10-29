import { useEffect } from "react";
import { useDesignerStore } from "../store/desingerStore";

/**
 * Hook para manejar atajos de teclado del historial
 */
export const useHistory = () => {
  const { undo, redo, canUndo, canRedo, saveHistory } = useDesignerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z para deshacer
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }

      // Ctrl/Cmd + Shift + Z para rehacer
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }

      // Ctrl/Cmd + Y para rehacer (alternativo)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return {
    undo,
    redo,
    canUndo: canUndo(),
    canRedo: canRedo(),
    saveHistory,
  };
};
