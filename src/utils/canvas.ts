import { CanvasElement, Position, Dimensions, CanvasConfig } from '@/types';

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
    (a, b) => b.dimensions.width * b.dimensions.height - 
              a.dimensions.width * a.dimensions.height
  );

  const optimized: CanvasElement[] = [];
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);

  let currentX = 10;
  let currentY = 10;
  let rowHeight = 0;

  sortedElements.forEach((element) => {
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
      console.warn('Elemento no cabe en el canvas:', element.id);
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
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);

  return (
    element.position.x >= 0 &&
    element.position.y >= 0 &&
    element.position.x + element.dimensions.width <= canvasWidth &&
    element.position.y + element.dimensions.height <= canvasHeight
  );
};

/**
 * Ajusta la posición del elemento para que esté dentro del canvas
 */
export const constrainToCanvas = (
  position: Position,
  dimensions: Dimensions,
  canvasConfig: CanvasConfig
): Position => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);

  return {
    x: Math.max(0, Math.min(position.x, canvasWidth - dimensions.width)),
    y: Math.max(0, Math.min(position.y, canvasHeight - dimensions.height)),
  };
};