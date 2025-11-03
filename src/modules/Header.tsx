import React, { useState } from "react";
import {
  Undo,
  Redo,
  Download,
  Save,
  // Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
  GridIcon,
} from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import { exportCanvas } from "../utils/export";
import { Button } from "../components/Button";
import { optimizeLayout } from "../utils/canvas";

export const Header: React.FC = () => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    toggleGrid,
    showGrid,
    zoom,
    setZoom,
    saveProject,
    elements,
    // setCanvasConfig,
    canvasConfig,
  } = useDesignerStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("");

  const handleExport = async (format: "png" | "pdf") => {
    const canvasElement = document.querySelector(".konvajs-content");
    if (canvasElement) {
      try {
        await exportCanvas(canvasElement as HTMLElement, {
          format,
          transparent: true,
          // Pasar las dimensiones del canvas en cm para el PDF
          canvasWidth: canvasConfig.width,
          canvasHeight: canvasConfig.height,
        });
        setShowExportModal(false);
      } catch (error) {
        console.error("Error al exportar:", error);
        alert("Error al exportar el diseño");
      }
    }
  };

  const handleSave = () => {
    if (projectName.trim()) {
      saveProject(projectName);
      setShowSaveModal(false);
      setProjectName("");
      alert("Proyecto guardado exitosamente");
    }
  };

  const handleOptimizeLayout = () => {
    const optimized = optimizeLayout(elements, canvasConfig);
    // Actualizar elementos con nueva disposición
    optimized.forEach(el => {
      useDesignerStore.getState().updateElement(el.id, {
        position: el.position,
      });
    });
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">
            Diseño de Uniformes
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={redo}
            disabled={!canRedo()}
            title="Rehacer"
          >
            <Redo className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />
          {/* Zoom */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom - 0.1)}
            disabled={zoom <= 0.1}
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom + 0.1)}
            disabled={zoom >= 3}
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(1)}
            title="Zoom 100%"
          >
            <Maximize className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* Grid */}
          <Button
            size="sm"
            variant={showGrid ? "default" : "ghost"}
            onClick={toggleGrid}
            title="Mostrar/ocultar cuadrícula"
          >
            <GridIcon className="w-4 h-4" />
          </Button>

          {/* Optimize Layout */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOptimizeLayout}
            title="Optimizar disposición"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* Save/Load */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSaveModal(true)}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>

          {/* Export */}
          <Button size="sm" onClick={() => setShowExportModal(true)}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </header>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Exportar Diseño</h2>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => handleExport("png")}
                variant="outline"
              >
                Exportar como PNG
              </Button>
              <Button
                className="w-full"
                onClick={() => handleExport("pdf")}
                variant="outline"
              >
                Exportar como PDF
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setShowExportModal(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Guardar Proyecto</h2>
            <input
              type="text"
              placeholder="Nombre del proyecto"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave}>
                Guardar
              </Button>
              <Button
                className="flex-1"
                variant="ghost"
                onClick={() => {
                  setShowSaveModal(false);
                  setProjectName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
