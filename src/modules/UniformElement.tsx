import React, { useRef } from "react";
import { Group, Rect, Transformer, Image as KonvaImage } from "react-konva";

import useImage from "use-image";
import type { UniformTemplate } from "../types";
import { useDesignerStore } from "../store/desingerStore";
import {
  constrainToCanvas,
  CANVAS_MARGIN_CM,
  cmToPixels,
} from "../utils/canvas";
import type Konva from "konva";

interface UniformElementProps {
  element: UniformTemplate;
  isSelected: boolean;
}

const UniformShape: React.FC<{ element: UniformTemplate }> = ({ element }) => {
  const [image] = useImage(element.imageUrl || "");

  // Forma básica del uniforme (rectángulo con esquinas redondeadas)
  return (
    <>
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
      {image && (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={element.dimensions.width}
          height={element.dimensions.height}
          opacity={0.8}
        />
      )}
    </>
  );
};

export const UniformElement: React.FC<UniformElementProps> = ({
  element,
  isSelected,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const { updateElement, selectElement, canvasConfig } = useDesignerStore();

  const canvasWidth = canvasConfig.width * canvasConfig.pixelsPerCm;
  const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  React.useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      const layer = transformerRef.current.getLayer();
      if (layer) {
        layer.batchDraw();
      }
    }
  }, [isSelected]);

  // Función para limitar el arrastre en tiempo real
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const constrainedPos = constrainToCanvas(
      pos,
      element.dimensions,
      canvasConfig
    );
    return constrainedPos;
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

    const newWidth = Math.max(20, node.width() * scaleX);
    const newHeight = Math.max(20, node.height() * scaleY);

    // Verificar que las nuevas dimensiones no excedan el canvas
    const constrainedPosition = constrainToCanvas(
      { x: node.x(), y: node.y() },
      { width: newWidth, height: newHeight },
      canvasConfig
    );

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);
    node.position(constrainedPosition);

    updateElement(element.id, {
      dimensions: {
        width: newWidth,
        height: newHeight,
      },
      position: constrainedPosition,
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
      </Group>
    );
  }

  return (
    <>
      <Group
        ref={groupRef}
        x={element.position.x}
        y={element.position.y}
        rotation={element.rotation}
        draggable={!element.locked}
        dragBoundFunc={dragBoundFunc}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => selectElement(element.id)}
        onTap={() => selectElement(element.id)}
      >
        <UniformShape element={element} />
      </Group>

      {isSelected && !element.locked && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limitar tamaño mínimo
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }

            // Verificar que no exceda los límites del canvas con margen
            if (newBox.x < margin || newBox.y < margin) {
              return oldBox;
            }

            if (
              newBox.x + newBox.width > canvasWidth - margin ||
              newBox.y + newBox.height > canvasHeight - margin
            ) {
              return oldBox;
            }

            return newBox;
          }}
          keepRatio={false}
        />
      )}
    </>
  );
};
