import React, { useRef } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import type Konva from "konva";

import { UniformElement } from "./UniformElement";
import { TextElementComponent } from "./TextElement";
import { useDesignerStore } from "../store/desingerStore";
import { cmToPixels, CANVAS_MARGIN_CM } from "../utils/canvas";
import { Pagination } from "../components/Pagination";

export const Canvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const {
    canvasConfig,
    elements,
    showGrid,
    zoom,
    selectElement,
    selectedElementId,
    currentPage,
    setCurrentPage,
    getTotalPages,
  } = useDesignerStore();

  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Deseleccionar si se hace clic en el fondo
    if (e.target === e.target.getStage()) {
      selectElement(null);
    }
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    const lines = [];
    const gridSize = cmToPixels(5, canvasConfig.pixelsPerCm); // Grid cada 5cm

    // Líneas verticales
    for (let i = 0; i <= canvasWidth; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, canvasHeight]}
          stroke="#e0e0e0"
          strokeWidth={1}
        />
      );
    }

    // Líneas horizontales
    for (let i = 0; i <= canvasHeight; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, canvasWidth, i]}
          stroke="#e0e0e0"
          strokeWidth={1}
        />
      );
    }

    return lines;
  };

  const totalPages = getTotalPages();

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <div
          className="bg-white shadow-lg relative"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
          }}
        >
        <Stage
          ref={stageRef}
          width={canvasWidth * zoom}
          height={canvasHeight * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            {/* Fondo del canvas */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="white"
            />

            {/* Borde del canvas para marcar límites */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              stroke="#e5e7eb"
              strokeWidth={2}
              listening={false}
            />

            {/* Área permitida para elementos (con margen de 1cm) */}
            <Rect
              x={margin}
              y={margin}
              width={canvasWidth - margin * 2}
              height={canvasHeight - margin * 2}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[10, 5]}
              listening={false}
            />

            {/* Grid */}
            {renderGrid()}

            {/* Elementos */}
            {elements
              .filter(el => el.visible)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map(element => {
                if (element.type === "uniform") {
                  return (
                    <UniformElement
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedElementId}
                    />
                  );
                } else if (element.type === "text") {
                  return (
                    <TextElementComponent
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedElementId}
                    />
                  );
                }
                return null;
              })}
          </Layer>
        </Stage>
        </div>

        {/* Información del canvas */}
        <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded shadow text-sm">
          <div className="flex gap-4">
            <span>
              Tamaño: {canvasConfig.width} × {canvasConfig.height} cm
            </span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>Elementos: {elements.length}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Los elementos deben permanecer dentro del área azul punteada (margen
            de 1cm)
          </div>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
