import React, { useRef } from "react";
import { Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { TextElement } from "../types";
import { useDesignerStore } from "../store/desingerStore";
import {
  constrainToCanvas,
  CANVAS_MARGIN_CM,
  cmToPixels,
} from "../utils/canvas";

interface TextElementProps {
  element: TextElement;
  isSelected: boolean;
}

export const TextElementComponent: React.FC<TextElementProps> = ({
  element,
  isSelected,
}) => {
  const textRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const { updateElement, selectElement, canvasConfig } = useDesignerStore();

  const canvasWidth = canvasConfig.width * canvasConfig.pixelsPerCm;
  const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  React.useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current]);
      const layer = transformerRef.current.getLayer();
      if (layer) {
        layer.batchDraw();
      }
    }
  }, [isSelected]);

  // Función para limitar el arrastre en tiempo real
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const node = textRef.current;
    if (!node) return pos;

    const textWidth = node.width();
    const textHeight = node.height();

    const constrainedPos = constrainToCanvas(
      pos,
      { width: textWidth, height: textHeight },
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
    const node = textRef.current;
    if (!node) return;

    const scaleX = node.scaleX();

    const newFontSize = Math.max(10, element.fontSize * scaleX);
    const textWidth = node.width();
    const textHeight = node.height();

    // Verificar límites del canvas
    const constrainedPosition = constrainToCanvas(
      { x: node.x(), y: node.y() },
      { width: textWidth, height: textHeight },
      canvasConfig
    );

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);
    node.position(constrainedPosition);

    updateElement(element.id, {
      fontSize: newFontSize,
      position: constrainedPosition,
      rotation: node.rotation(),
    });
  };

  if (element.locked) {
    return (
      <Text
        x={element.position.x}
        y={element.position.y}
        text={element.content}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fontColor}
        rotation={element.rotation}
        align={element.textAlign}
        fontStyle={element.fontWeight === "bold" ? "bold" : "normal"}
        opacity={element.opacity}
      />
    );
  }

  return (
    <>
      <Text
        ref={textRef}
        x={element.position.x}
        y={element.position.y}
        text={element.content}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fontColor}
        rotation={element.rotation}
        align={element.textAlign}
        fontStyle={element.fontWeight === "bold" ? "bold" : "normal"}
        opacity={element.opacity}
        draggable={!element.locked}
        dragBoundFunc={dragBoundFunc}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => selectElement(element.id)}
        onTap={() => selectElement(element.id)}
      />

      {isSelected && !element.locked && (
        <Transformer
          ref={transformerRef}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            // Limitar tamaño mínimo
            if (newBox.width < 20) {
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
        />
      )}
    </>
  );
};
