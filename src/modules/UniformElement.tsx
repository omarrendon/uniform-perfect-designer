import React, { useRef, useState, useEffect } from "react";
import { Group, Rect, Transformer, Image as KonvaImage, Text } from "react-konva";

import { loadImage } from "../utils/imageCache";
import type { UniformTemplate } from "../types";
import { useDesignerStore } from "../store/desingerStore";
import type Konva from "konva";

interface UniformElementProps {
  element: UniformTemplate;
  isSelected: boolean;
}

// Cache de canvases offscreen renderizados a 2× DPR por URL de SVG
const _svgCanvasCache = new Map<string, HTMLCanvasElement | 'loading' | 'error'>();
const _svgCanvasCallbacks = new Map<string, Array<(c: HTMLCanvasElement | null) => void>>();

function _loadSvgOffscreen(
  url: string,
  width: number,
  height: number,
  callback: (c: HTMLCanvasElement | null) => void,
): void {
  const cached = _svgCanvasCache.get(url);
  if (cached === 'error') { callback(null); return; }
  if (cached instanceof HTMLCanvasElement) { callback(cached); return; }
  if (cached === 'loading') {
    _svgCanvasCallbacks.get(url)!.push(callback);
    return;
  }

  _svgCanvasCache.set(url, 'loading');
  _svgCanvasCallbacks.set(url, [callback]);

  const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 2) || 2;
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    _svgCanvasCache.set(url, canvas);
    _svgCanvasCallbacks.get(url)!.forEach(l => l(canvas));
    _svgCanvasCallbacks.delete(url);
  };

  img.onerror = () => {
    _svgCanvasCache.set(url, 'error');
    _svgCanvasCallbacks.get(url)!.forEach(l => l(null));
    _svgCanvasCallbacks.delete(url);
  };

  img.src = url;
}

// Renderiza SVG con el renderer nativo del browser via canvas offscreen (2× DPR)
const SvgUniformShape: React.FC<{ element: UniformTemplate }> = ({ element }) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!element.imageUrl) { setCanvas(null); return; }
    _loadSvgOffscreen(
      element.imageUrl,
      element.dimensions.width,
      element.dimensions.height,
      setCanvas,
    );
  }, [element.imageUrl, element.dimensions.width, element.dimensions.height]);

  if (!canvas) {
    return (
      <Rect
        x={0}
        y={0}
        width={element.dimensions.width}
        height={element.dimensions.height}
        fill={element.baseColor}
        cornerRadius={element.part === 'jersey' ? 10 : 5}
        opacity={0.3}
      />
    );
  }

  return (
    <KonvaImage
      image={canvas}
      x={0}
      y={0}
      width={element.dimensions.width}
      height={element.dimensions.height}
    />
  );
};

// Renderiza una imagen raster (PNG/JPEG) con KonvaImage — flujo legado
const RasterUniformShape: React.FC<{ element: UniformTemplate }> = ({ element }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (element.imageUrl) {
      loadImage(element.imageUrl, (img) => setImage(img));
    } else {
      setImage(null);
    }
  }, [element.imageUrl]);

  if (image) {
    return (
      <KonvaImage
        image={image}
        x={0}
        y={0}
        width={element.dimensions.width}
        height={element.dimensions.height}
        opacity={1}
      />
    );
  }

  return (
    <Rect
      x={0}
      y={0}
      width={element.dimensions.width}
      height={element.dimensions.height}
      fill={element.baseColor}
      cornerRadius={element.part === "jersey" ? 10 : 5}
      shadowBlur={5}
      shadowOpacity={0.3}
    />
  );
};

const UniformShape: React.FC<{ element: UniformTemplate }> = ({ element }) => {
  if (element.isSvg) {
    return <SvgUniformShape element={element} />;
  }
  return <RasterUniformShape element={element} />;
};

export const UniformElement: React.FC<UniformElementProps> = ({
  element,
  isSelected,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const { updateElement, selectElement, canvasConfig, isExporting } = useDesignerStore();

  const canvasWidth = canvasConfig.width * canvasConfig.pixelsPerCm;
  const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;

  React.useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      const layer = transformerRef.current.getLayer();
      if (layer) {
        layer.batchDraw();
      }
    }
  }, [isSelected]);

  // Función para limitar el arrastre en tiempo real (sin margen)
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const x = Math.max(0, Math.min(pos.x, canvasWidth - element.dimensions.width));
    const y = Math.max(0, Math.min(pos.y, canvasHeight - element.dimensions.height));
    return { x, y };
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateElement(element.id, {
      position: { x: e.target.x(), y: e.target.y() },
    });
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const newWidth = Math.max(20, element.dimensions.width * scaleX);
    const newHeight = Math.max(20, element.dimensions.height * scaleY);

    const x = Math.max(0, Math.min(node.x(), canvasWidth - newWidth));
    const y = Math.max(0, Math.min(node.y(), canvasHeight - newHeight));

    node.scaleX(1);
    node.scaleY(1);
    node.position({ x, y });

    updateElement(element.id, {
      dimensions: { width: newWidth, height: newHeight },
      position: { x, y },
      rotation: node.rotation(),
    });
  };

  if (element.locked) {
    return (
      <Group
        x={element.position.x}
        y={element.position.y}
        rotation={element.rotation}
      >
        <UniformShape element={element} />
        {(!isExporting || element.source === 'excel') && (
          <Text
            x={0}
            y={element.dimensions.height - 11}
            width={element.dimensions.width}
            text={`Talla ${element.size}`}
            fontSize={9}
            fontFamily="Arial"
            fontStyle="bold"
            fill="black"
            stroke="white"
            strokeWidth={2}
            align="center"
          />
        )}
      </Group>
    );
  }

  const offsetX = element.rotation !== 0 ? element.dimensions.width / 2 : 0;
  const offsetY = element.rotation !== 0 ? element.dimensions.height / 2 : 0;

  return (
    <>
      <Group
        ref={groupRef}
        x={element.position.x + offsetX}
        y={element.position.y + offsetY}
        offsetX={offsetX}
        offsetY={offsetY}
        rotation={element.rotation}
        draggable={!element.locked}
        dragBoundFunc={dragBoundFunc}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => selectElement(element.id)}
        onTap={() => selectElement(element.id)}
      >
        <UniformShape element={element} />
        {(!isExporting || element.source === 'excel') && (
          <Text
            x={0}
            y={element.dimensions.height - 11}
            width={element.dimensions.width}
            text={`Talla ${element.size}`}
            fontSize={9}
            fontFamily="Arial"
            fontStyle="bold"
            fill="black"
            stroke="white"
            strokeWidth={2}
            align="center"
          />
        )}
      </Group>

      {isSelected && !element.locked && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            if (newBox.x < 0 || newBox.y < 0) return oldBox;
            if (
              newBox.x + newBox.width > canvasWidth ||
              newBox.y + newBox.height > canvasHeight
            ) return oldBox;
            return newBox;
          }}
          keepRatio={false}
        />
      )}
    </>
  );
};
