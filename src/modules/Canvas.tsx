import React, { useRef } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";

import { cmToPixels } from "../utils/canvas";
import { UniformElement } from "./UniformElement";
import { TextElementComponent } from "./TextElement";
import { useDesignerStore } from "../store/desingerStore";

export const Canvas: React.FC = () => {
  const stageRef = useRef<any>(null);
  const {
    canvasConfig,
    elements,
    showGrid,
    zoom,
    selectElement,
    selectedElementId,
  } = useDesignerStore();

  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );

  const handleStageClick = (e: any) => {
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

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 overflow-hidden p-4">
      <div
        className="bg-white shadow-lg"
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
      </div>
    </div>
  );
};
