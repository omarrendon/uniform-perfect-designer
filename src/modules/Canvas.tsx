import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect } from "react-konva";
import type Konva from "konva";

import { UniformElement } from "./UniformElement";
import { TextElementComponent } from "./TextElement";
import { useDesignerStore } from "../store/desingerStore";
import { cmToPixels } from "../utils/canvas";
import { Pagination } from "../components/Pagination";

export const Canvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const {
    canvasConfig,
    elements,
    zoom,
    selectElement,
    selectedElementId,
    currentPage,
    setCurrentPage,
    getTotalPages,
    getPageHeight,
    isCanvasHidden,
  } = useDesignerStore();

  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);

  // Usar altura ajustada para la página actual
  const currentPageHeight = getPageHeight(currentPage);
  const canvasHeight = cmToPixels(currentPageHeight, canvasConfig.pixelsPerCm);

  // Detectar el ancho del contenedor
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 40; // Restar padding
        setContainerWidth(width);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);

    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  // Calcular el ancho efectivo del canvas (el menor entre el ancho del contenedor y el ancho calculado)
  const effectiveCanvasWidth = containerWidth > 0 ? Math.min(containerWidth, canvasWidth * zoom) : canvasWidth * zoom;

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Deseleccionar si se hace clic en el fondo
    if (e.target === e.target.getStage()) {
      selectElement(null);
    }
  };

  const totalPages = getTotalPages();

  // Si el canvas está oculto, mostrar mensaje de carga
  if (isCanvasHidden) {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-lg mb-2">
              Cargando uniformes...
            </div>
            <div className="text-gray-400 text-sm">
              El canvas se mostrará cuando termine la carga
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246))',
        width: '100%',
        height: '100%',
      }}
    >
      {/* Contenedor principal con referencia para medir el ancho */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          padding: '20px 20px 20px 10px',
        }}
      >
        {/* Canvas con ancho completo */}
        <div
          className="bg-white shadow-2xl rounded-lg relative overflow-hidden"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
            border: '1px solid #d1d5db',
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
        <div
          style={{
            position: 'absolute',
            top: '32px',
            right: '32px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgb(229, 231, 235)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: '600', color: 'rgb(55, 65, 81)' }}>Tamaño:</span>
              <span style={{ color: 'rgb(107, 114, 128)' }}>
                {canvasConfig.width} × {currentPageHeight.toFixed(1)} cm
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: '600', color: 'rgb(55, 65, 81)' }}>Zoom:</span>
              <span style={{ color: 'rgb(107, 114, 128)' }}>{Math.round(zoom * 100)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: '600', color: 'rgb(55, 65, 81)' }}>Elementos:</span>
              <span style={{ color: 'rgb(107, 114, 128)' }}>{elements.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Paginación - Fuera del grid para que quede abajo */}
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
