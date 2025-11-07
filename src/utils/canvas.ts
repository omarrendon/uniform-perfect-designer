import type { CanvasElement, Position, Dimensions, CanvasConfig } from "../types";

/**
 * Convierte centímetros a píxeles
 */
export const cmToPixels = (cm: number, pixelsPerCm: number): number => {
  return cm * pixelsPerCm;
};

/**
 * Convierte píxeles a centímetros
 */
export const pixelsToCm = (pixels: number, pixelsPerCm: number): number => {
  return pixels / pixelsPerCm;
};

/**
 * Calcula si dos elementos se superponen
 */
export const checkOverlap = (
  el1: CanvasElement,
  el2: CanvasElement
): boolean => {
  const el1Right = el1.position.x + el1.dimensions.width;
  const el1Bottom = el1.position.y + el1.dimensions.height;
  const el2Right = el2.position.x + el2.dimensions.width;
  const el2Bottom = el2.position.y + el2.dimensions.height;

  return !(
    el1Right < el2.position.x ||
    el1.position.x > el2Right ||
    el1Bottom < el2.position.y ||
    el1.position.y > el2Bottom
  );
};

/**
 * Optimiza la disposición de elementos para evitar superposiciones
 * Implementación básica de bin-packing
 */
export const optimizeLayout = (
  elements: CanvasElement[],
  canvasConfig: CanvasConfig
): CanvasElement[] => {
  if (elements.length === 0) return elements;

  const sortedElements = [...elements].sort(
    (a, b) =>
      b.dimensions.width * b.dimensions.height -
      a.dimensions.width * a.dimensions.height
  );

  const optimized: CanvasElement[] = [];
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );

  let currentX = 10;
  let currentY = 10;
  let rowHeight = 0;

  sortedElements.forEach(element => {
    const elementWidth = element.dimensions.width;
    const elementHeight = element.dimensions.height;

    // Si el elemento no cabe en la fila actual, pasar a la siguiente
    if (currentX + elementWidth > canvasWidth - 10) {
      currentX = 10;
      currentY += rowHeight + 10;
      rowHeight = 0;
    }

    // Si el elemento no cabe en el canvas verticalmente, advertir
    if (currentY + elementHeight > canvasHeight - 10) {
      console.warn("Elemento no cabe en el canvas:", element.id);
    }

    optimized.push({
      ...element,
      position: { x: currentX, y: currentY },
    });

    currentX += elementWidth + 10;
    rowHeight = Math.max(rowHeight, elementHeight);
  });

  return optimized;
};

/**
 * Calcula el espacio restante en el canvas
 */
export const calculateRemainingSpace = (
  elements: CanvasElement[],
  canvasConfig: CanvasConfig
): number => {
  const totalCanvasArea =
    cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm) *
    cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);

  const usedArea = elements.reduce((acc, el) => {
    return acc + el.dimensions.width * el.dimensions.height;
  }, 0);

  return Math.max(0, totalCanvasArea - usedArea);
};

/**
 * Calcula el porcentaje de espacio utilizado
 */
export const calculateSpaceUsage = (
  elements: CanvasElement[],
  canvasConfig: CanvasConfig
): number => {
  const totalCanvasArea =
    cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm) *
    cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);

  const usedArea = elements.reduce((acc, el) => {
    return acc + el.dimensions.width * el.dimensions.height;
  }, 0);

  return (usedArea / totalCanvasArea) * 100;
};

/**
 * Genera un ID único
 */
export const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Valida si un elemento está dentro de los límites del canvas
 */
export const isWithinCanvas = (
  element: CanvasElement,
  canvasConfig: CanvasConfig
): boolean => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );

  return (
    element.position.x >= 0 &&
    element.position.y >= 0 &&
    element.position.x + element.dimensions.width <= canvasWidth &&
    element.position.y + element.dimensions.height <= canvasHeight
  );
};

/**
 * Margen de seguridad en cm que se debe respetar en los bordes del canvas
 */
export const CANVAS_MARGIN_CM = 1;

/**
 * Ajusta la posición del elemento para que esté dentro del canvas
 * respetando un margen de 1cm en todos los lados
 */
export const constrainToCanvas = (
  position: Position,
  dimensions: Dimensions,
  canvasConfig: CanvasConfig
): Position => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  return {
    x: Math.max(
      margin,
      Math.min(position.x, canvasWidth - dimensions.width - margin)
    ),
    y: Math.max(
      margin,
      Math.min(position.y, canvasHeight - dimensions.height - margin)
    ),
  };
};

/**
 * Encuentra una posición válida para un nuevo elemento evitando colisiones
 * con elementos existentes
 */
export const findValidPosition = (
  dimensions: Dimensions,
  existingElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  preferredPosition?: Position
): Position => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  // Posición inicial preferida o default
  const startX = preferredPosition?.x ?? margin + 50;
  const startY = preferredPosition?.y ?? margin + 50;

  // Función auxiliar para verificar si una posición tiene colisión
  const hasCollision = (position: Position): boolean => {
    const testElement: CanvasElement = {
      id: "temp",
      type: "uniform",
      position,
      dimensions,
      rotation: 0,
      zIndex: 0,
      locked: false,
      visible: true,
    } as CanvasElement;

    return existingElements.some(
      el => el.visible && checkOverlap(testElement, el)
    );
  };

  // Función para verificar si está dentro del canvas con márgenes
  const isInsideCanvas = (position: Position): boolean => {
    return (
      position.x >= margin &&
      position.y >= margin &&
      position.x + dimensions.width <= canvasWidth - margin &&
      position.y + dimensions.height <= canvasHeight - margin
    );
  };

  // Intentar la posición preferida primero
  if (
    isInsideCanvas({ x: startX, y: startY }) &&
    !hasCollision({ x: startX, y: startY })
  ) {
    return { x: startX, y: startY };
  }

  // Estrategia 1: Buscar en una cuadrícula con espaciado de 20 píxeles
  // POSICIONAMIENTO HORIZONTAL: buscar de izquierda a derecha, luego siguiente fila
  const spacing = 20;
  const maxX = canvasWidth - dimensions.width - margin;
  const maxY = canvasHeight - dimensions.height - margin;

  // Buscar en filas (horizontal): primero de izquierda a derecha, luego siguiente fila
  for (let y = margin; y <= maxY; y += spacing) {
    for (let x = margin; x <= maxX; x += spacing) {
      const position = { x, y };
      if (isInsideCanvas(position) && !hasCollision(position)) {
        return position;
      }
    }
  }

  // Estrategia 2: Buscar con menor espaciado si no se encontró nada (también horizontal)
  const fineSpacing = 10;
  for (let y = margin; y <= maxY; y += fineSpacing) {
    for (let x = margin; x <= maxX; x += fineSpacing) {
      const position = { x, y };
      if (isInsideCanvas(position) && !hasCollision(position)) {
        return position;
      }
    }
  }

  // Si no se encuentra espacio libre, retornar la posición preferida
  // ajustada a los límites del canvas (puede estar encimada pero al menos visible)
  return constrainToCanvas({ x: startX, y: startY }, dimensions, canvasConfig);
};

/**
 * Verifica si hay espacio disponible en el canvas para un nuevo elemento
 * con las dimensiones especificadas sin que se encime con elementos existentes
 */
export const hasSpaceForElement = (
  dimensions: Dimensions,
  existingElements: CanvasElement[],
  canvasConfig: CanvasConfig
): boolean => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(
    canvasConfig.height,
    canvasConfig.pixelsPerCm
  );
  const margin = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm);

  // Función auxiliar para verificar si una posición tiene colisión
  const hasCollision = (position: Position): boolean => {
    const testElement: CanvasElement = {
      id: "temp",
      type: "uniform",
      position,
      dimensions,
      rotation: 0,
      zIndex: 0,
      locked: false,
      visible: true,
    } as CanvasElement;

    return existingElements.some(
      el => el.visible && checkOverlap(testElement, el)
    );
  };

  // Función para verificar si está dentro del canvas con márgenes
  const isInsideCanvas = (position: Position): boolean => {
    return (
      position.x >= margin &&
      position.y >= margin &&
      position.x + dimensions.width <= canvasWidth - margin &&
      position.y + dimensions.height <= canvasHeight - margin
    );
  };

  // Verificar si el elemento cabe dentro del canvas
  if (
    dimensions.width > canvasWidth - 2 * margin ||
    dimensions.height > canvasHeight - 2 * margin
  ) {
    return false;
  }

  // Buscar con espaciado fino para determinar si hay espacio (horizontal)
  const spacing = 10;
  const maxX = canvasWidth - dimensions.width - margin;
  const maxY = canvasHeight - dimensions.height - margin;

  // Buscar horizontalmente: de izquierda a derecha, luego siguiente fila
  for (let y = margin; y <= maxY; y += spacing) {
    for (let x = margin; x <= maxX; x += spacing) {
      const position = { x, y };
      if (isInsideCanvas(position) && !hasCollision(position)) {
        return true; // Se encontró al menos un espacio libre
      }
    }
  }

  return false; // No hay espacio disponible
};
