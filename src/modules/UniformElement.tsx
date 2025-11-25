import React, { useRef } from "react";
import { Group, Rect, Transformer, Image as KonvaImage, Text } from "react-konva";

import useImage from "use-image";
import type { UniformTemplate } from "../types";
import { useDesignerStore } from "../store/desingerStore";
import type Konva from "konva";

interface UniformElementProps {
  element: UniformTemplate;
  isSelected: boolean;
}

const UniformShape: React.FC<{ element: UniformTemplate }> = ({ element }) => {
  const [image] = useImage(element.imageUrl || "");

  // Si hay imagen, mostrarla sin rotación (la rotación se aplica al Group)
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

  // Forma básica del uniforme (rectángulo con esquinas redondeadas) cuando no hay imagen
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

export const UniformElement: React.FC<UniformElementProps> = ({
  element,
  isSelected,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const { updateElement, selectElement, canvasConfig } = useDesignerStore();

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
    // Limitar dentro del canvas sin margen
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

    // Usar las dimensiones originales del elemento multiplicadas por la escala
    // No usar node.width()/height() porque el Group no tiene tamaño explícito
    const newWidth = Math.max(20, element.dimensions.width * scaleX);
    const newHeight = Math.max(20, element.dimensions.height * scaleY);

    // Ajustar posición sin margen
    const x = Math.max(0, Math.min(node.x(), canvasWidth - newWidth));
    const y = Math.max(0, Math.min(node.y(), canvasHeight - newHeight));
    const constrainedPosition = { x, y };

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
        {/* Texto de talla en la parte inferior del molde */}
        <Text
          x={0}
          y={element.dimensions.height - 11}
          width={element.dimensions.width}
          text={`Talla ${element.size}`}
          fontSize={9}
          fontFamily="Arial"
          fontStyle="bold"
          fill="black"
          align="center"
        />
      </Group>
    );
  }

  // Calcular offset para rotación desde el centro del elemento
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
        {/* Texto de talla en la parte inferior del molde */}
        <Text
          x={0}
          y={element.dimensions.height - 11}
          width={element.dimensions.width}
          text={`Talla ${element.size}`}
          fontSize={9}
          fontFamily="Arial"
          fontStyle="bold"
          fill="black"
          align="center"
        />
      </Group>

      {isSelected && !element.locked && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limitar tamaño mínimo
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }

            // Verificar que no exceda los límites del canvas (sin margen)
            if (newBox.x < 0 || newBox.y < 0) {
              return oldBox;
            }

            if (
              newBox.x + newBox.width > canvasWidth ||
              newBox.y + newBox.height > canvasHeight
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
