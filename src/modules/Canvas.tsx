import React, { useRef } from "react";
import { Stage, Layer, Rect } from "react-konva";
import type Konva from "konva";

import { UniformElement } from "./UniformElement";
import { TextElementComponent } from "./TextElement";
import { useDesignerStore } from "../store/desingerStore";
import { cmToPixels } from "../utils/canvas";
import { Pagination } from "../components/Pagination";

export const Canvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const {
    canvasConfig,
    elements,
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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Deseleccionar si se hace clic en el fondo
    if (e.target === e.target.getStage()) {
      selectElement(null);
    }
  };

  const totalPages = getTotalPages();

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-1 flex items-center justify-center overflow-auto relative">
        <div
          className="bg-white shadow-2xl rounded-lg relative overflow-hidden"
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

        {/* Información del canvas - Posicionada en la esquina superior derecha */}
        <div className="absolute top-8 right-8 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-gray-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">Tamaño:</span>
              <span className="text-gray-600">{canvasConfig.width} × {canvasConfig.height} cm</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">Zoom:</span>
              <span className="text-gray-600">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">Elementos:</span>
              <span className="text-gray-600">{elements.length}</span>
            </div>
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
