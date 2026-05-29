import type { CanvasElement, Position, Dimensions, CanvasConfig } from "../types";
import type { UniformTemplate } from "../types";
import { cmToPixels } from "./canvas";
import { type BitmapMask, BITMAP_SCALE, masksOverlap } from "./svgBitmap";

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
  bitmaps?: Map<string, BitmapMask>; // Máscaras SVG para compaction por silueta real
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
}

/**
 * Configuración por defecto
 */
const DEFAULT_OPTIONS: LayoutOptions = {
  elementGap: 5,                // 0.5cm = 5px
  canvasMargin: 0,              // 0px - sin margen horizontal
  canvasMarginV: 0,             // 0px - sin margen vertical
  allowRotation: false,         // Por defecto no rotar (uniformes tienen orientación)
  sortStrategy: 'area',
  heuristic: 'BL',              // Bottom-Left: prioriza posición arriba-izquierda para espaciado uniforme
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
          };
        }
      }
    }

    if (bestResult) {
      // Actualizar los rectángulos libres
      const finalWidth = bestResult.rotated ? paddedHeight : paddedWidth;
      const finalHeight = bestResult.rotated ? paddedWidth : paddedHeight;
      this.splitFreeRectangles(bestResult.position, finalWidth, finalHeight);
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
   * Actualiza TODOS los rectángulos libres después de colocar un elemento.
   * Cualquier rect que intersecte con el área colocada se divide en hasta 4 franjas
   * (izquierda, derecha, arriba, abajo) que excluyen el área ocupada.
   */
  private splitFreeRectangles(position: Position, width: number, height: number): void {
    const placedLeft = position.x;
    const placedRight = position.x + width;
    const placedTop = position.y;
    const placedBottom = position.y + height;

    const survivingRects: FreeRectangle[] = [];

    for (const rect of this.freeRectangles) {
      const noIntersect = (
        rect.x >= placedRight ||
        rect.x + rect.width <= placedLeft ||
        rect.y >= placedBottom ||
        rect.y + rect.height <= placedTop
      );
      if (noIntersect) {
        survivingRects.push(rect);
        continue;
      }
      // Franja izquierda
      if (rect.x < placedLeft) {
        survivingRects.push({ x: rect.x, y: rect.y, width: placedLeft - rect.x, height: rect.height });
      }
      // Franja derecha
      if (rect.x + rect.width > placedRight) {
        survivingRects.push({ x: placedRight, y: rect.y, width: rect.x + rect.width - placedRight, height: rect.height });
      }
      // Franja superior
      if (rect.y < placedTop) {
        survivingRects.push({ x: rect.x, y: rect.y, width: rect.width, height: placedTop - rect.y });
      }
      // Franja inferior
      if (rect.y + rect.height > placedBottom) {
        survivingRects.push({ x: rect.x, y: placedBottom, width: rect.width, height: rect.y + rect.height - placedBottom });
      }
    }

    this.freeRectangles = survivingRects;
    this.pruneRedundantRectangles();
  }

  /**
   * Elimina rectángulos que están completamente contenidos en otros
   */
  private pruneRedundantRectangles(): void {
    const toRemove: Set<number> = new Set();

    for (let i = 0; i < this.freeRectangles.length; i++) {
      for (let j = 0; j < this.freeRectangles.length; j++) {
        if (i !== j && !toRemove.has(i) && !toRemove.has(j) && this.isContainedIn(this.freeRectangles[i], this.freeRectangles[j])) {
          toRemove.add(i);
          break;
        }
      }
    }

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
 * Paso real en píxeles para el compaction (1 píxel de bitmap = 1/BITMAP_SCALE reales)
 */
const COMPACT_STEP = Math.round(1 / BITMAP_SCALE); // 15 px

/**
 * Construye la key del bitmap para un elemento (url:w:h[:rot]).
 * Retorna null si el elemento no es SVG o no tiene imageUrl.
 */
function getBitmapKey(el: CanvasElement): string | null {
  if (el.type !== 'uniform') return null;
  const u = el as UniformTemplate;
  if (!u.imageUrl || !u.isSvg) return null;
  const wk = Math.round(u.dimensions.width);
  const hk = Math.round(u.dimensions.height);
  return u.rotation !== 0
    ? `${u.imageUrl}:${wk}:${hk}:${u.rotation}`
    : `${u.imageUrl}:${wk}:${hk}`;
}

function bboxOverlapWithGap(
  pos1: Position, dim1: Dimensions,
  pos2: Position, dim2: Dimensions,
  gap: number,
): boolean {
  return !(
    pos1.x + dim1.width  + gap <= pos2.x ||
    pos2.x + dim2.width  + gap <= pos1.x ||
    pos1.y + dim1.height + gap <= pos2.y ||
    pos2.y + dim2.height + gap <= pos1.y
  );
}

/**
 * Post-proceso de compactación 2D: desliza cada elemento hacia arriba y hacia la izquierda
 * usando colisión de silueta real (bitmap). Procesa de arriba-izquierda hacia abajo-derecha
 * para que los elementos ya asentados sirvan de tope real a los que vienen detrás.
 * Las áreas cóncavas (axilas, cintura, cuello) permiten que otras piezas encajen ahí.
 * Converge en MAX_PASSES pasadas o cuando ningún elemento se mueve.
 */
function compactLayout(
  elements: CanvasElement[],
  options: LayoutOptions,
): CanvasElement[] {
  const { bitmaps, elementGap } = options;
  if (!bitmaps?.size || elements.length < 2) return elements;
  const bitmapsSafe = bitmaps;

  const positions = elements.map(el => ({ ...el.position }));
  const MAX_PASSES = 10;

  function hasConflict(i: number, candidate: Position): boolean {
    const el = elements[i];
    const key = getBitmapKey(el);
    const mask = key ? bitmapsSafe.get(key) : undefined;

    for (let j = 0; j < elements.length; j++) {
      if (j === i) continue;
      const elj = elements[j];
      const keyj = getBitmapKey(elj);
      const maskj = keyj ? bitmapsSafe.get(keyj) : undefined;

      if (mask && maskj) {
        if (masksOverlap(mask, candidate, maskj, positions[j], elementGap)) return true;
      } else {
        if (bboxOverlapWithGap(candidate, el.dimensions, positions[j], elj.dimensions, elementGap)) return true;
      }
    }
    return false;
  }

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;

    // Procesar de arriba-izquierda a abajo-derecha:
    // los elementos ya asentados en la parte superior sirven de tope bitmap real.
    const order = elements
      .map((_, i) => i)
      .sort((a, b) => positions[a].y !== positions[b].y
        ? positions[a].y - positions[b].y
        : positions[a].x - positions[b].x);

    for (const i of order) {
      // 1. Deslizar hacia ARRIBA — permite que piezas encajen en concavidades superiores
      while (positions[i].y >= COMPACT_STEP) {
        const candidate = { x: positions[i].x, y: positions[i].y - COMPACT_STEP };
        if (hasConflict(i, candidate)) break;
        positions[i] = candidate;
        moved = true;
      }

      // 2. Deslizar hacia la IZQUIERDA
      while (positions[i].x >= COMPACT_STEP) {
        const candidate = { x: positions[i].x - COMPACT_STEP, y: positions[i].y };
        if (hasConflict(i, candidate)) break;
        positions[i] = candidate;
        moved = true;
      }
    }

    if (!moved) break;
  }

  return elements.map((el, i) => ({ ...el, position: positions[i] }));
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

  // Interleave complementario: short más ancho + playera más angosta comparten fila.
  // Short XL (~952px) + Jersey XS (~513px) ≈ ancho canvas → fila casi sin desperdicio.
  const isShort = (el: CanvasElement) =>
    el.type === 'uniform' && (el as UniformTemplate).part === 'shorts';

  const shortsDesc = [...elements]
    .filter(isShort)
    .sort((a, b) => b.dimensions.width - a.dimensions.width);

  const jerseysAsc = [...elements]
    .filter(el => !isShort(el))
    .sort((a, b) => a.dimensions.width - b.dimensions.width);

  const orderedElements: CanvasElement[] = [];
  const maxLen = Math.max(shortsDesc.length, jerseysAsc.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < shortsDesc.length) orderedElements.push(shortsDesc[i]);
    if (i < jerseysAsc.length) orderedElements.push(jerseysAsc[i]);
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

  // Compaction por silueta real si hay bitmaps disponibles
  if (finalOptions.bitmaps?.size) {
    for (let p = 0; p < pages.length; p++) {
      pages[p] = compactLayout(pages[p], finalOptions);
    }
  }

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
