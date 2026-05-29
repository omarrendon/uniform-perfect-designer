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

// Cache de canvases offscreen renderizados a 2× DPR por "url:w:h"
const _svgCanvasCache = new Map<string, HTMLCanvasElement | 'loading' | 'error'>();
const _svgCanvasCallbacks = new Map<string, Array<(c: HTMLCanvasElement | null) => void>>();

function _loadSvgOffscreen(
  url: string,
  width: number,
  height: number,
  callback: (c: HTMLCanvasElement | null) => void,
): void {
  const key = `${url}:${Math.round(width)}:${Math.round(height)}`;
  const cached = _svgCanvasCache.get(key);
  if (cached === 'error') { callback(null); return; }
  if (cached instanceof HTMLCanvasElement) { callback(cached); return; }
  if (cached === 'loading') {
    _svgCanvasCallbacks.get(key)!.push(callback);
    return;
  }

  _svgCanvasCache.set(key, 'loading');
  _svgCanvasCallbacks.set(key, [callback]);

  const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 2) || 2;
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    _svgCanvasCache.set(key, canvas);
    _svgCanvasCallbacks.get(key)!.forEach(l => l(canvas));
    _svgCanvasCallbacks.delete(key);
  };

  img.onerror = () => {
    _svgCanvasCache.set(key, 'error');
    _svgCanvasCallbacks.get(key)!.forEach(l => l(null));
    _svgCanvasCallbacks.delete(key);
  };

  img.src = url;
}

// Renderiza SVG con el renderer nativo del browser via canvas offscreen (2× DPR)
const SvgUniformShape: React.FC<{ element: UniformTemplate; imageW: number; imageH: number }> = ({ element, imageW, imageH }) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!element.imageUrl) { setCanvas(null); return; }
    _loadSvgOffscreen(
      element.imageUrl,
      imageW,
      imageH,
      setCanvas,
    );
  }, [element.imageUrl, imageW, imageH]);

  if (!canvas) {
    return (
      <Rect
        x={0}
        y={0}
        width={imageW}
        height={imageH}
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
      width={imageW}
      height={imageH}
    />
  );
};

// Renderiza una imagen raster (PNG/JPEG) con KonvaImage — flujo legado
const RasterUniformShape: React.FC<{ element: UniformTemplate; imageW: number; imageH: number }> = ({ element, imageW, imageH }) => {
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
        width={imageW}
        height={imageH}
        opacity={1}
      />
    );
  }

  return (
    <Rect
      x={0}
      y={0}
      width={imageW}
      height={imageH}
      fill={element.baseColor}
      cornerRadius={element.part === "jersey" ? 10 : 5}
      shadowBlur={5}
      shadowOpacity={0.3}
    />
  );
};

const UniformShape: React.FC<{ element: UniformTemplate; imageW: number; imageH: number }> = ({ element, imageW, imageH }) => {
  if (element.isSvg) {
    return <SvgUniformShape element={element} imageW={imageW} imageH={imageH} />;
  }
  return <RasterUniformShape element={element} imageW={imageW} imageH={imageH} />;
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

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const x = Math.max(0, Math.min(pos.x, canvasWidth - element.dimensions.width));
    const y = Math.max(0, Math.min(pos.y, canvasHeight - element.dimensions.height));
    return { x, y };
  };

  // Compute rendering parameters based on rotation.
  // For 90°/270°, stored dims are swapped (storedW=origH, storedH=origW),
  // so we render the image at its original (pre-swap) dimensions.
  const sw = element.dimensions.width;
  const sh = element.dimensions.height;
  const is90or270 = element.rotation === 90 || element.rotation === 270;
  const imageW = is90or270 ? sh : sw;
  const imageH = is90or270 ? sw : sh;

  // Group x/y offset and Konva offsetX/Y so the image bounding box
  // always occupies [position.x, position.x+sw] × [position.y, position.y+sh].
  let gxOff = 0, gyOff = 0, ox = 0, oy = 0;
  if (element.rotation === 90) {
    gyOff = sh;
  } else if (element.rotation === 180) {
    gxOff = sw / 2; gyOff = sh / 2; ox = sw / 2; oy = sh / 2;
  } else if (element.rotation === 270) {
    gxOff = sw;
  }

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
        x={element.position.x + gxOff}
        y={element.position.y + gyOff}
        offsetX={ox}
        offsetY={oy}
        rotation={element.rotation}
      >
        <UniformShape element={element} imageW={imageW} imageH={imageH} />
        {(!isExporting || element.source === 'excel') && (
          <Text
            x={0}
            y={imageH - 11}
            width={imageW}
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

  return (
    <>
      <Group
        ref={groupRef}
        x={element.position.x + gxOff}
        y={element.position.y + gyOff}
        offsetX={ox}
        offsetY={oy}
        rotation={element.rotation}
        draggable={!element.locked}
        dragBoundFunc={dragBoundFunc}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => selectElement(element.id)}
        onTap={() => selectElement(element.id)}
      >
        <UniformShape element={element} imageW={imageW} imageH={imageH} />
        {(!isExporting || element.source === 'excel') && (
          <Text
            x={0}
            y={imageH - 11}
            width={imageW}
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
          rotateEnabled={false}
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
