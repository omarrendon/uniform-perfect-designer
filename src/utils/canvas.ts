import type { CanvasElement, Position, Dimensions, CanvasConfig } from "../types";
import { optimizeLayoutMaxRects, type LayoutOptions } from "./binPacking";

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
 * Usa el algoritmo MaxRects para mejor aprovechamiento del espacio
 */
export const optimizeLayout = (
  elements: CanvasElement[],
  canvasConfig: CanvasConfig,
  options?: Partial<LayoutOptions>
): CanvasElement[] => {
  if (elements.length === 0) return elements;

  // Usar el nuevo algoritmo MaxRects optimizado
  return optimizeLayoutMaxRects(elements, canvasConfig, {
    elementGap: 5,      // 0.5cm entre elementos
    canvasMargin: 0,    // 0px - sin margen horizontal
    canvasMarginV: 0,   // 0px - sin margen vertical
    allowRotation: false, // No rotar uniformes por defecto
    sortStrategy: 'area',
    heuristic: 'BL',    // Bottom-Left: espaciado uniforme horizontal y vertical
    ...options,
  });
};

/**
 * Versión legacy del algoritmo de layout (Shelf algorithm)
 * Mantenida para compatibilidad
 */
export const optimizeLayoutLegacy = (
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

  // Separación entre moldes: 0.5cm = 5mm = 5 píxeles (con pixelsPerCm = 10)
  const elementGap = 5;

  let currentX = elementGap;
  let currentY = elementGap;
  let rowHeight = 0;

  sortedElements.forEach(element => {
    const elementWidth = element.dimensions.width;
    const elementHeight = element.dimensions.height;

    // Si el elemento no cabe en la fila actual, pasar a la siguiente
    if (currentX + elementWidth > canvasWidth - elementGap) {
      currentX = elementGap;
      currentY += rowHeight + elementGap;
      rowHeight = 0;
    }

    // Si el elemento no cabe en el canvas verticalmente, advertir
    if (currentY + elementHeight > canvasHeight - elementGap) {
      console.warn("Elemento no cabe en el canvas:", element.id);
    }

    optimized.push({
      ...element,
      position: { x: currentX, y: currentY },
    });

    currentX += elementWidth + elementGap;
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
export const CANVAS_MARGIN_CM = 0;

/**
 * Ajusta la posición del elemento para que esté dentro del canvas
 * respetando el margen configurado en CANVAS_MARGIN_CM
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
 * Verifica si hay espacio disponible en un lado específico del canvas
 */
export const hasSpaceForElementOnSide = (
  dimensions: Dimensions,
  existingElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  side: 'left' | 'right'
): boolean => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);
  const elementGap = 5;

  const midPoint = canvasWidth / 2;
  const minX = side === 'left' ? 0 : midPoint + elementGap;
  const maxX = side === 'left' ? midPoint - dimensions.width - elementGap : canvasWidth - dimensions.width;
  const maxY = canvasHeight - dimensions.height;

  // Verificar colisiones
  const hasCollision = (position: Position): boolean => {
    for (const el of existingElements) {
      if (!el.visible) continue;
      const noOverlap =
        position.x + dimensions.width + elementGap <= el.position.x ||
        position.x >= el.position.x + el.dimensions.width + elementGap ||
        position.y + dimensions.height + elementGap <= el.position.y ||
        position.y >= el.position.y + el.dimensions.height + elementGap;
      if (!noOverlap) return true;
    }
    return false;
  };

  // Buscar si existe al menos una posición válida
  for (let y = 0; y <= maxY; y += elementGap) {
    for (let x = minX; x <= maxX; x += elementGap) {
      const position = { x, y };
      if (!hasCollision(position)) {
        return true; // Hay espacio disponible
      }
    }
  }

  return false; // No hay espacio disponible
};

/**
 * Encuentra una posición válida en un lado específico del canvas
 * side: 'left' = lado izquierdo, 'right' = lado derecho
 */
export const findValidPositionOnSide = (
  dimensions: Dimensions,
  existingElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  side: 'left' | 'right'
): Position => {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);
  const elementGap = 5;

  // Dividir el canvas en dos mitades
  const midPoint = canvasWidth / 2;

  // Definir límites según el lado (con margen para evitar superposición en el medio)
  const minX = side === 'left' ? 0 : midPoint + elementGap;
  const maxX = side === 'left' ? midPoint - dimensions.width - elementGap : canvasWidth - dimensions.width;
  const maxY = canvasHeight - dimensions.height;

  // Función de colisión - considera TODOS los elementos existentes
  const hasCollision = (position: Position): boolean => {
    for (const el of existingElements) {
      if (!el.visible) continue;
      const noOverlap =
        position.x + dimensions.width + elementGap <= el.position.x ||
        position.x >= el.position.x + el.dimensions.width + elementGap ||
        position.y + dimensions.height + elementGap <= el.position.y ||
        position.y >= el.position.y + el.dimensions.height + elementGap;
      if (!noOverlap) return true;
    }
    return false;
  };

  // Función para verificar si está dentro del área permitida del lado correspondiente
  const isInsideArea = (position: Position): boolean => {
    return (
      position.x >= minX &&
      position.x <= maxX &&
      position.y >= 0 &&
      position.y <= maxY
    );
  };

  // Generar posiciones candidatas basadas en los bordes de elementos existentes del mismo lado
  const candidateX: number[] = [minX];
  const candidateY: number[] = [0];

  for (const el of existingElements) {
    if (!el.visible) continue;

    // Solo considerar elementos del mismo lado para generar candidatos X
    const elIsOnSameSide = side === 'left'
      ? el.position.x < midPoint
      : el.position.x >= midPoint;

    if (elIsOnSameSide) {
      const nextX = el.position.x + el.dimensions.width + elementGap;
      if (nextX >= minX && nextX <= maxX) {
        candidateX.push(nextX);
      }
    }

    // Considerar todos los elementos para candidatos Y
    const nextY = el.position.y + el.dimensions.height + elementGap;
    if (nextY >= 0 && nextY <= maxY) {
      candidateY.push(nextY);
    }
  }

  // Ordenar candidatos
  const uniqueX = [...new Set(candidateX)].sort((a, b) => a - b);
  const uniqueY = [...new Set(candidateY)].sort((a, b) => a - b);

  // Buscar posición válida
  for (const y of uniqueY) {
    for (const x of uniqueX) {
      const position = { x, y };
      if (isInsideArea(position) && !hasCollision(position)) {
        return position;
      }
    }
  }

  // Búsqueda fina si no se encontró
  for (let y = 0; y <= maxY; y += elementGap) {
    for (let x = minX; x <= maxX; x += elementGap) {
      const position = { x, y };
      if (isInsideArea(position) && !hasCollision(position)) {
        return position;
      }
    }
  }

  // Default: esquina del lado correspondiente
  return { x: minX, y: 0 };
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
  const marginH = 0; // Sin margen horizontal
  const marginV = 0; // Sin margen vertical

  // Gap entre elementos (0.5cm = 5px)
  const elementGap = 5;

  // Posición inicial preferida o default
  const startX = preferredPosition?.x ?? marginH;
  const startY = preferredPosition?.y ?? marginV;

  // Función auxiliar para verificar si una posición tiene colisión
  // Considera el gap entre elementos (5px = 0.5cm total entre moldes)
  const hasCollision = (position: Position): boolean => {
    // Verificar colisión con cada elemento existente considerando el gap
    for (const el of existingElements) {
      if (!el.visible) continue;

      // Verificar si hay superposición considerando el gap
      // El gap total entre dos elementos debe ser exactamente elementGap (5px)
      // Solo aplicamos el gap en una dirección para evitar duplicación
      const noOverlap =
        position.x + dimensions.width + elementGap <= el.position.x || // Nuevo está a la izquierda
        position.x >= el.position.x + el.dimensions.width + elementGap || // Nuevo está a la derecha
        position.y + dimensions.height + elementGap <= el.position.y || // Nuevo está arriba
        position.y >= el.position.y + el.dimensions.height + elementGap; // Nuevo está abajo

      if (!noOverlap) {
        return true; // Hay colisión
      }
    }
    return false;
  };

  // Función para verificar si está dentro del canvas con márgenes
  const isInsideCanvas = (position: Position): boolean => {
    return (
      position.x >= marginH &&
      position.y >= marginV &&
      position.x + dimensions.width <= canvasWidth - marginH &&
      position.y + dimensions.height <= canvasHeight - marginV
    );
  };

  // Intentar la posición preferida primero
  if (
    isInsideCanvas({ x: startX, y: startY }) &&
    !hasCollision({ x: startX, y: startY })
  ) {
    return { x: startX, y: startY };
  }

  // Estrategia 1: Buscar posiciones óptimas basadas en los bordes de elementos existentes
  // Esto asegura que los elementos se coloquen exactamente con el gap correcto (5px = 0.5cm)
  const maxX = canvasWidth - dimensions.width - marginH;
  const maxY = canvasHeight - dimensions.height - marginV;

  // Generar posiciones candidatas basadas en los bordes de elementos existentes
  const candidateX: number[] = [marginH]; // Empezar desde el margen
  const candidateY: number[] = [marginV];

  for (const el of existingElements) {
    if (!el.visible) continue;
    // Posición justo después de cada elemento existente (con gap de 5px)
    candidateX.push(el.position.x + el.dimensions.width + elementGap);
    candidateY.push(el.position.y + el.dimensions.height + elementGap);
  }

  // Ordenar y eliminar duplicados
  const uniqueX = [...new Set(candidateX)].sort((a, b) => a - b).filter(x => x <= maxX);
  const uniqueY = [...new Set(candidateY)].sort((a, b) => a - b).filter(y => y <= maxY);

  // Función de colisión simplificada para posiciones candidatas (sin duplicar gap)
  const hasCollisionSimple = (position: Position): boolean => {
    for (const el of existingElements) {
      if (!el.visible) continue;
      // Solo verificar superposición directa, el gap ya está incluido en la posición candidata
      const noOverlap =
        position.x + dimensions.width <= el.position.x ||
        position.x >= el.position.x + el.dimensions.width + elementGap ||
        position.y + dimensions.height <= el.position.y ||
        position.y >= el.position.y + el.dimensions.height + elementGap;

      if (!noOverlap) {
        return true;
      }
    }
    return false;
  };

  // Buscar en las posiciones candidatas (horizontal first)
  for (const y of uniqueY) {
    for (const x of uniqueX) {
      const position = { x, y };
      if (isInsideCanvas(position) && !hasCollisionSimple(position)) {
        return position;
      }
    }
  }

  // Estrategia 2: Buscar con espaciado fino si no se encontró en candidatos
  const fineSpacing = 1;
  for (let y = marginV; y <= maxY; y += fineSpacing) {
    for (let x = marginH; x <= maxX; x += fineSpacing) {
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
  const marginH = cmToPixels(CANVAS_MARGIN_CM, canvasConfig.pixelsPerCm); // Margen horizontal
  const marginV = 0; // Sin margen vertical

  // Gap entre elementos (0.5cm = 5px)
  const elementGap = 5;

  // Función auxiliar para verificar si una posición tiene colisión
  // Considera el gap entre elementos en todas las direcciones
  const hasCollision = (position: Position): boolean => {
    for (const el of existingElements) {
      if (!el.visible) continue;

      const noOverlap =
        position.x + dimensions.width + elementGap <= el.position.x ||
        position.x >= el.position.x + el.dimensions.width + elementGap ||
        position.y + dimensions.height + elementGap <= el.position.y ||
        position.y >= el.position.y + el.dimensions.height + elementGap;

      if (!noOverlap) {
        return true;
      }
    }
    return false;
  };

  // Función para verificar si está dentro del canvas con márgenes
  const isInsideCanvas = (position: Position): boolean => {
    return (
      position.x >= marginH &&
      position.y >= marginV &&
      position.x + dimensions.width <= canvasWidth - marginH &&
      position.y + dimensions.height <= canvasHeight - marginV
    );
  };

  // Verificar si el elemento cabe dentro del canvas
  if (
    dimensions.width > canvasWidth - 2 * marginH ||
    dimensions.height > canvasHeight - 2 * marginV
  ) {
    return false;
  }

  // Buscar con espaciado igual al gap para determinar si hay espacio (horizontal)
  const spacing = elementGap;
  const maxX = canvasWidth - dimensions.width - marginH;
  const maxY = canvasHeight - dimensions.height - marginV;

  // Buscar horizontalmente: de izquierda a derecha, luego siguiente fila
  for (let y = marginV; y <= maxY; y += spacing) {
    for (let x = marginH; x <= maxX; x += spacing) {
      const position = { x, y };
      if (isInsideCanvas(position) && !hasCollision(position)) {
        return true; // Se encontró al menos un espacio libre
      }
    }
  }

  return false; // No hay espacio disponible
};
