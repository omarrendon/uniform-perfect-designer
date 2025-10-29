import React, { useRef } from "react";
import { Group, Rect, Transformer, Image as KonvaImage } from "react-konva";

import useImage from "use-image";
import { useDesignerStore } from "../store/desingerStore";
import type { UniformTemplate } from "../types";

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
  const groupRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const { updateElement, selectElement } = useDesignerStore();

  React.useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
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
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    updateElement(element.id, {
      dimensions: {
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
      },
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
            return newBox;
          }}
        />
      )}
    </>
  );
};
