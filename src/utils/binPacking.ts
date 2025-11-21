import type { CanvasElement, Position, CanvasConfig } from "../types";
import { cmToPixels } from "./canvas";

/**
 * Representa un rectángulo libre disponible para colocar elementos
 */
interface FreeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Opciones de configuración para el algoritmo de layout
 */
export interface LayoutOptions {
  elementGap: number;           // Separación entre elementos (px)
  canvasMargin: number;         // Margen horizontal del borde del canvas (px)
  canvasMarginV: number;        // Margen vertical del borde del canvas (px)
  allowRotation: boolean;       // Permitir rotar elementos 90°
  sortStrategy: 'area' | 'height' | 'width' | 'perimeter';
  heuristic: 'BSSF' | 'BLSF' | 'BAF' | 'BL';
}

/**
 * Resultado del layout con métricas
 */
export interface LayoutResult {
  pages: CanvasElement[][];     // Elementos organizados por página
  efficiency: number;           // % de espacio utilizado
  wastedSpace: number;          // Área desperdiciada en px²
  pagesUsed: number;            // Número de páginas necesarias
  totalElements: number;        // Total de elementos procesados
}

/**
 * Resultado de intentar colocar un elemento
 */
interface PlacementResult {
  position: Position;
  rotated: boolean;
  score: number;                // Menor es mejor
  rectIndex: number;            // Índice del rectángulo libre usado
}

/**
 * Configuración por defecto
 */
const DEFAULT_OPTIONS: LayoutOptions = {
  elementGap: 5,                // 0.5cm = 5px
  canvasMargin: 10,             // 1cm = 10px (horizontal)
  canvasMarginV: 0,             // 0px (vertical) - moldes pegados al borde
  allowRotation: false,         // Por defecto no rotar (uniformes tienen orientación)
  sortStrategy: 'area',
  heuristic: 'BSSF',
};

/**
 * Clase que implementa el algoritmo MaxRects para bin-packing 2D
 */
class MaxRectsBinPack {
  private canvasWidth: number;
  private canvasHeight: number;
  private freeRectangles: FreeRectangle[];
  private options: LayoutOptions;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    options: Partial<LayoutOptions> = {}
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Inicializar con el espacio libre completo (menos márgenes)
    const marginH = this.options.canvasMargin;
    const marginV = this.options.canvasMarginV;
    this.freeRectangles = [{
      x: marginH,
      y: marginV,
      width: canvasWidth - 2 * marginH,
      height: canvasHeight - 2 * marginV,
    }];
  }

  /**
   * Reinicia el packer para una nueva página
   */
  reset(): void {
    const marginH = this.options.canvasMargin;
    const marginV = this.options.canvasMarginV;
    this.freeRectangles = [{
      x: marginH,
      y: marginV,
      width: this.canvasWidth - 2 * marginH,
      height: this.canvasHeight - 2 * marginV,
    }];
  }

  /**
   * Intenta colocar un elemento en el mejor espacio disponible
   */
  place(width: number, height: number): PlacementResult | null {
    // Agregar gap al tamaño del elemento
    const paddedWidth = width + this.options.elementGap;
    const paddedHeight = height + this.options.elementGap;

    let bestResult: PlacementResult | null = null;

    // Buscar en todos los rectángulos libres
    for (let i = 0; i < this.freeRectangles.length; i++) {
      const rect = this.freeRectangles[i];

      // Intentar sin rotación
      if (paddedWidth <= rect.width && paddedHeight <= rect.height) {
        const score = this.calculateScore(rect, paddedWidth, paddedHeight);
        if (!bestResult || score < bestResult.score) {
          bestResult = {
            position: { x: rect.x, y: rect.y },
            rotated: false,
            score,
            rectIndex: i,
          };
        }
      }

      // Intentar con rotación (si está permitido)
      if (this.options.allowRotation && paddedHeight <= rect.width && paddedWidth <= rect.height) {
        const score = this.calculateScore(rect, paddedHeight, paddedWidth);
        if (!bestResult || score < bestResult.score) {
          bestResult = {
            position: { x: rect.x, y: rect.y },
            rotated: true,
            score,
            rectIndex: i,
          };
        }
      }
    }

    if (bestResult) {
      // Actualizar los rectángulos libres
      const finalWidth = bestResult.rotated ? paddedHeight : paddedWidth;
      const finalHeight = bestResult.rotated ? paddedWidth : paddedHeight;
      this.splitFreeRectangle(bestResult.rectIndex, bestResult.position, finalWidth, finalHeight);
    }

    return bestResult;
  }

  /**
   * Calcula el score según la heurística seleccionada
   * Menor score = mejor posición
   */
  private calculateScore(rect: FreeRectangle, width: number, height: number): number {
    switch (this.options.heuristic) {
      case 'BSSF': // Best Short Side Fit
        return Math.min(rect.width - width, rect.height - height);

      case 'BLSF': // Best Long Side Fit
        return Math.max(rect.width - width, rect.height - height);

      case 'BAF': // Best Area Fit
        return rect.width * rect.height - width * height;

      case 'BL': // Bottom-Left
        return rect.y * 10000 + rect.x; // Priorizar posición arriba-izquierda

      default:
        return rect.width * rect.height - width * height;
    }
  }

  /**
   * Divide un rectángulo libre después de colocar un elemento
   * Usa el método "Guillotine split" con la regla "Shorter Axis Split"
   */
  private splitFreeRectangle(
    rectIndex: number,
    position: Position,
    width: number,
    height: number
  ): void {
    const rect = this.freeRectangles[rectIndex];
    const newRects: FreeRectangle[] = [];

    // Espacio a la derecha del elemento
    if (rect.x + rect.width > position.x + width) {
      newRects.push({
        x: position.x + width,
        y: rect.y,
        width: rect.x + rect.width - (position.x + width),
        height: rect.height,
      });
    }

    // Espacio debajo del elemento
    if (rect.y + rect.height > position.y + height) {
      newRects.push({
        x: rect.x,
        y: position.y + height,
        width: rect.width,
        height: rect.y + rect.height - (position.y + height),
      });
    }

    // Eliminar el rectángulo usado y agregar los nuevos
    this.freeRectangles.splice(rectIndex, 1, ...newRects);

    // Eliminar rectángulos que se volvieron redundantes (contenidos en otros)
    this.pruneRedundantRectangles();
  }

  /**
   * Elimina rectángulos que están completamente contenidos en otros
   */
  private pruneRedundantRectangles(): void {
    const toRemove: Set<number> = new Set();

    for (let i = 0; i < this.freeRectangles.length; i++) {
      for (let j = 0; j < this.freeRectangles.length; j++) {
        if (i !== j && !toRemove.has(i) && this.isContainedIn(this.freeRectangles[i], this.freeRectangles[j])) {
          toRemove.add(i);
          break;
        }
      }
    }

    // Eliminar de atrás hacia adelante para mantener índices válidos
    const indices = Array.from(toRemove).sort((a, b) => b - a);
    for (const idx of indices) {
      this.freeRectangles.splice(idx, 1);
    }
  }

  /**
   * Verifica si un rectángulo está completamente contenido en otro
   */
  private isContainedIn(inner: FreeRectangle, outer: FreeRectangle): boolean {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  }

  /**
   * Calcula el área total libre disponible
   */
  getTotalFreeArea(): number {
    return this.freeRectangles.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  }
}

/**
 * Ordena los elementos según la estrategia especificada
 */
function sortElements(
  elements: CanvasElement[],
  strategy: LayoutOptions['sortStrategy']
): CanvasElement[] {
  return [...elements].sort((a, b) => {
    switch (strategy) {
      case 'area':
        return (b.dimensions.width * b.dimensions.height) - (a.dimensions.width * a.dimensions.height);
      case 'height':
        return b.dimensions.height - a.dimensions.height;
      case 'width':
        return b.dimensions.width - a.dimensions.width;
      case 'perimeter':
        return (2 * (b.dimensions.width + b.dimensions.height)) - (2 * (a.dimensions.width + a.dimensions.height));
      default:
        return 0;
    }
  });
}

/**
 * Agrupa elementos por tamaño similar para mejor acomodo
 */
function groupBySize(elements: CanvasElement[]): Map<string, CanvasElement[]> {
  const groups = new Map<string, CanvasElement[]>();

  for (const element of elements) {
    const key = `${element.dimensions.width}x${element.dimensions.height}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(element);
  }

  return groups;
}

/**
 * Algoritmo principal de layout optimizado con MaxRects
 * Soporta múltiples páginas automáticas
 */
export function optimizeLayoutAdvanced(
  elements: CanvasElement[],
  canvasConfig: CanvasConfig,
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  if (elements.length === 0) {
    return {
      pages: [[]],
      efficiency: 0,
      wastedSpace: 0,
      pagesUsed: 1,
      totalElements: 0,
    };
  }

  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);
  const canvasArea = canvasWidth * canvasHeight;

  // Ordenar elementos según estrategia
  const sortedElements = sortElements(elements, finalOptions.sortStrategy);

  // Agrupar por tamaño para mejor eficiencia
  const sizeGroups = groupBySize(sortedElements);

  // Reordenar: grupos más grandes primero, dentro de cada grupo mantener orden
  const orderedElements: CanvasElement[] = [];
  const sortedGroups = Array.from(sizeGroups.entries()).sort((a, b) => {
    const [keyA] = a;
    const [keyB] = b;
    const [wA, hA] = keyA.split('x').map(Number);
    const [wB, hB] = keyB.split('x').map(Number);
    return (wB * hB) - (wA * hA);
  });

  for (const [, group] of sortedGroups) {
    orderedElements.push(...group);
  }

  // Inicializar el packer
  const packer = new MaxRectsBinPack(canvasWidth, canvasHeight, finalOptions);

  const pages: CanvasElement[][] = [[]];
  let currentPageIndex = 0;
  let totalUsedArea = 0;

  // Procesar cada elemento
  for (const element of orderedElements) {
    const width = element.dimensions.width;
    const height = element.dimensions.height;

    // Intentar colocar en la página actual
    let result = packer.place(width, height);

    // Si no cabe, crear nueva página
    if (!result) {
      currentPageIndex++;
      pages.push([]);
      packer.reset();
      result = packer.place(width, height);

      // Si aún no cabe, el elemento es muy grande para el canvas
      if (!result) {
        console.warn(`Elemento ${element.id} es demasiado grande para el canvas`);
        continue;
      }
    }

    // Crear el elemento posicionado
    const positionedElement: CanvasElement = {
      ...element,
      position: result.position,
      // Si se rotó, intercambiar dimensiones
      dimensions: result.rotated
        ? { width: height, height: width }
        : element.dimensions,
      rotation: result.rotated ? (element.rotation + 90) % 360 : element.rotation,
    };

    pages[currentPageIndex].push(positionedElement);
    totalUsedArea += width * height;
  }

  // Calcular métricas
  const pagesUsed = pages.length;
  const totalCanvasArea = canvasArea * pagesUsed;
  const efficiency = (totalUsedArea / totalCanvasArea) * 100;
  const wastedSpace = totalCanvasArea - totalUsedArea;

  return {
    pages,
    efficiency,
    wastedSpace,
    pagesUsed,
    totalElements: orderedElements.length,
  };
}

/**
 * Versión simplificada que retorna solo los elementos de la primera página
 * Compatible con la firma de optimizeLayout original
 */
export function optimizeLayoutMaxRects(
  elements: CanvasElement[],
  canvasConfig: CanvasConfig,
  options: Partial<LayoutOptions> = {}
): CanvasElement[] {
  const result = optimizeLayoutAdvanced(elements, canvasConfig, options);
  return result.pages[0] || [];
}

/**
 * Calcula métricas de eficiencia para un layout existente
 */
export function calculateLayoutMetrics(
  elements: CanvasElement[],
  canvasConfig: CanvasConfig
): { efficiency: number; wastedSpace: number; overlap: boolean } {
  const canvasWidth = cmToPixels(canvasConfig.width, canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);
  const canvasArea = canvasWidth * canvasHeight;

  const usedArea = elements.reduce(
    (sum, el) => sum + el.dimensions.width * el.dimensions.height,
    0
  );

  // Verificar superposiciones
  let hasOverlap = false;
  for (let i = 0; i < elements.length && !hasOverlap; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const el1 = elements[i];
      const el2 = elements[j];

      const overlap = !(
        el1.position.x + el1.dimensions.width <= el2.position.x ||
        el2.position.x + el2.dimensions.width <= el1.position.x ||
        el1.position.y + el1.dimensions.height <= el2.position.y ||
        el2.position.y + el2.dimensions.height <= el1.position.y
      );

      if (overlap) {
        hasOverlap = true;
        break;
      }
    }
  }

  return {
    efficiency: (usedArea / canvasArea) * 100,
    wastedSpace: canvasArea - usedArea,
    overlap: hasOverlap,
  };
}
