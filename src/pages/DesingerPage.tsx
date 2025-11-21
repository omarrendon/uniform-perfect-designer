import React from "react";
import { useHistory } from "../hooks/useHistory";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useAutoSave } from "../hooks/useAutoSave";
import { Header } from "../modules/Header";
import { Toolbar } from "../modules/Toolbar";
import { Canvas } from "../modules/Canvas";

export const DesignerPage: React.FC = () => {
  // Habilitar atajos de teclado
  useHistory();
  useKeyboardShortcuts();

  // Habilitar auto-guardado cada 30 segundos
  useAutoSave(30000);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <Canvas />
      </div>
    </div>
  );
};
