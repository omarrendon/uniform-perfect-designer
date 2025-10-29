import React, { useRef } from "react";
import { Text, Transformer } from "react-konva";

import { useDesignerStore } from "../store/desingerStore";
import type { TextElement } from "../types";

interface TextElementProps {
  element: TextElement;
  isSelected: boolean;
}

export const TextElementComponent: React.FC<TextElementProps> = ({
  element,
  isSelected,
}) => {
  const textRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const { updateElement, selectElement } = useDesignerStore();

  React.useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: any) => {
    updateElement(element.id, {
      position: {
        x: e.target.x(),
        y: e.target.y(),
      },
    });
  };

  const handleTransformEnd = () => {
    const node = textRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    updateElement(element.id, {
      fontSize: Math.max(10, element.fontSize * scaleX),
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
            if (newBox.width < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};
