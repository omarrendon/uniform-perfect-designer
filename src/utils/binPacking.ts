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
export class MaxRectsBinPack {
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
   * Descarta o recorta rectángulos libres que empiecen antes de minY.
   * Úsalo para que MaxRects no invada el espacio ya ocupado por el bloque XL.
   */
  setMinimumY(minY: number): void {
    if (minY <= 0) return;
    const updated: FreeRectangle[] = [];
    for (const r of this.freeRectangles) {
      if (r.y + r.height <= minY) continue;
      if (r.y < minY) {
        updated.push({ x: r.x, y: minY, width: r.width, height: r.y + r.height - minY });
      } else {
        updated.push(r);
      }
    }
    this.freeRectangles = updated;
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
 * Algoritmo principal de layout con acomodo especial 2×2 para talla XL
 * y MaxRects BL (interleave complementario) para el resto de tallas.
 *
 * Bloque XL por jugador:
 *   Fila par:   jerseyFrente (x=0) | shortsRight rot=180 (x=jW+gap)
 *   Fila impar: shortsLeft   (x=0) | jerseyEspalda      (x=sW+gap)
 */
export function optimizeLayoutAdvanced(
  elements: CanvasElement[],
  canvasConfig: CanvasConfig,
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  if (elements.length === 0) {
    return { pages: [[]], efficiency: 0, wastedSpace: 0, pagesUsed: 1, totalElements: 0 };
  }

  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const canvasWidth  = cmToPixels(canvasConfig.width,  canvasConfig.pixelsPerCm);
  const canvasHeight = cmToPixels(canvasConfig.height, canvasConfig.pixelsPerCm);
  const canvasArea   = canvasWidth * canvasHeight;
  const gap          = finalOptions.elementGap;

  // ── DEBUG TEMPORAL ───────────────────────────────────────────────────────
  console.log('[Layout] elements:', elements.length, '| canvasH:', canvasHeight, 'px | canvasW:', canvasWidth, 'px');

  // ── Clasificadores ───────────────────────────────────────────────────────
  const XL_SIZES = new Set(['XL', 'XG', '2XL', '2XG', '3XL', '3XG']);
  const isXL    = (el: CanvasElement) => XL_SIZES.has((el as UniformTemplate).size as string);
  const isShort = (el: CanvasElement) => el.type === 'uniform' && (el as UniformTemplate).part === 'shorts';
  const isJrsy  = (el: CanvasElement) => el.type === 'uniform' && (el as UniformTemplate).part === 'jersey';

  // ── Separar XL (jerseys + shorts) del resto ──────────────────────────────
  const xlJerseys    = elements.filter(el => isJrsy(el)  && isXL(el));
  const xlShorts_180 = elements.filter(el => isShort(el) && isXL(el) && (el as UniformTemplate).rotation === 180);
  const xlShorts_0   = elements.filter(el => isShort(el) && isXL(el) && (el as UniformTemplate).rotation !== 180);
  // Todo lo que no sea jersey/short XL va al pool del MaxRects (incluye mangas, cuellos, tallas menores)
  const nonXlPool    = elements.filter(el => !isXL(el) || (!isJrsy(el) && !isShort(el)));

  const pages: CanvasElement[][] = [[]];
  let pageIdx      = 0;
  let yOffset      = 0;
  let totalUsedArea = 0;

  // ── PASO 1: Bloques 2×2 para XL ─────────────────────────────────────────
  // Cada bloque cubre las 4 piezas de un jugador XL:
  //   Fila par:   jerseyFrente (izq) + shortsRight_180 (der)
  //   Fila impar: shortsLeft_0 (izq) + jerseyEspalda  (der)
  const nBlocks = Math.min(
    Math.floor(xlJerseys.length / 2),
    xlShorts_0.length,
    xlShorts_180.length,
  );

  // ── DEBUG TEMPORAL PASO 1 ────────────────────────────────────────────────
  console.log('[PASO 1] xlJerseys:', xlJerseys.length, '| xlShorts_0:', xlShorts_0.length, '| xlShorts_180:', xlShorts_180.length, '| nBlocks:', nBlocks);
  console.log('[PASO 1] nonXlPool:', nonXlPool.length, '| canvasH:', canvasHeight);

  for (let i = 0; i < nBlocks; i++) {
    const jFront  = xlJerseys[i * 2];
    const jBack   = xlJerseys[i * 2 + 1];
    const sRot0   = xlShorts_0[i];
    const sRot180 = xlShorts_180[i];

    const jW = jFront.dimensions.width;
    const jH = jFront.dimensions.height;
    const sW = sRot0.dimensions.width;
    const sH = sRot0.dimensions.height;

    const rowH_even = Math.max(jH, sH) + gap;   // fila par: jersey + short_180
    const rowH_odd  = Math.max(sH, jH) + gap;   // fila impar: short_0 + jersey
    const blockH    = rowH_even + rowH_odd;

    if (yOffset > 0 && yOffset + blockH > canvasHeight) {
      pageIdx++;
      pages.push([]);
      yOffset = 0;
    }

    // Fila par: jerseyFrente izq | shortsRight_180 der
    pages[pageIdx].push({ ...jFront,  position: { x: 0,        y: yOffset } });
    pages[pageIdx].push({ ...sRot180, position: { x: jW + gap, y: yOffset } });
    totalUsedArea += jW * jH + sW * sH;
    yOffset += rowH_even;

    // Fila impar: shortsLeft_0 izq | jerseyEspalda der
    pages[pageIdx].push({ ...sRot0, position: { x: 0,        y: yOffset } });
    pages[pageIdx].push({ ...jBack, position: { x: sW + gap, y: yOffset } });
    totalUsedArea += sW * sH + jW * jH;
    yOffset += rowH_odd;
  }

  // Piezas XL sin bloque completo → caen al MaxRects junto al resto
  const xlLeftover: CanvasElement[] = [
    ...xlJerseys.slice(nBlocks * 2),
    ...xlShorts_0.slice(nBlocks),
    ...xlShorts_180.slice(nBlocks),
  ];

  // ── PASO 2: Columnas independientes para no-XL ───────────────────────────
  // Columna izquierda (shorts) avanza sh.height + gap independientemente.
  // Columna derecha  (jerseys) avanza j.height  + gap independientemente.
  // Cada columna llena la página hasta su propio tope, eliminando el espacio
  // muerto que generaba sincronizar ambas alturas en una sola fila compartida.
  const restElements = [...nonXlPool, ...xlLeftover];

  if (restElements.length > 0) {
    const shortsDesc = [...restElements]
      .filter(isShort)
      .sort((a, b) => b.dimensions.width - a.dimensions.width);

    const jerseysAsc = [...restElements]
      .filter(el => !isShort(el))
      .sort((a, b) => a.dimensions.width - b.dimensions.width);

    // x fija de la columna derecha: ancho del short más ancho + gap.
    // Sin shorts, se usa el jersey más ancho para que ambas columnas no se solapen.
    const jerseyColX = shortsDesc.length > 0
      ? shortsDesc[0].dimensions.width + gap
      : jerseysAsc.length > 0
        ? jerseysAsc[jerseysAsc.length - 1].dimensions.width + gap
        : 0;

    let shortIdx  = 0;
    let jerseyIdx = 0;

    while (shortIdx < shortsDesc.length || jerseyIdx < jerseysAsc.length) {
      const progressBefore = shortIdx + jerseyIdx;
      // Capturar ANTES de Fase 1: si los shorts ya estaban agotados al inicio de
      // esta iteración de página, Fase 2 se salta para que Fase 3 maneje ambas columnas.
      const shortsExhaustedAtStart = shortIdx >= shortsDesc.length;

      let yLeft  = yOffset;
      let yRight = yOffset;

      // Fase 1: columna izquierda con shorts.
      // Se omite cuando no hay jerseys: en ese caso Fase 4 distribuye en ambas columnas.
      if (jerseysAsc.length > 0) {
        while (shortIdx < shortsDesc.length) {
          const sh = shortsDesc[shortIdx];
          if (yLeft + sh.dimensions.height + gap > canvasHeight) break;
          pages[pageIdx].push({ ...sh, position: { x: 0, y: yLeft } });
          totalUsedArea += sh.dimensions.width * sh.dimensions.height;
          yLeft += sh.dimensions.height + gap;
          shortIdx++;
        }
      }

      // Fase 2: columna derecha con jerseys.
      // Se omite cuando los shorts ya estaban agotados al inicio de esta página,
      // para que Fase 3 pueda usar ambas columnas en lugar de llenar solo la derecha.
      if (!shortsExhaustedAtStart) {
        while (jerseyIdx < jerseysAsc.length) {
          const j = jerseysAsc[jerseyIdx];
          if (yRight + j.dimensions.height + gap > canvasHeight) break;
          pages[pageIdx].push({ ...j, position: { x: jerseyColX, y: yRight } });
          totalUsedArea += j.dimensions.width * j.dimensions.height;
          yRight += j.dimensions.height + gap;
          jerseyIdx++;
        }
      }

      // Fase 3: shorts agotados → jerseys restantes usan ambas columnas (greedy)
      // Se activa cuando ya no hay más shorts en ninguna página siguiente.
      // El cursor más bajo recibe el siguiente jersey para distribuir uniformemente.
      if (shortIdx >= shortsDesc.length) {
        while (jerseyIdx < jerseysAsc.length) {
          const j = jerseysAsc[jerseyIdx];
          const leftFits  = yLeft  + j.dimensions.height + gap <= canvasHeight;
          const rightFits = yRight + j.dimensions.height + gap <= canvasHeight;

          if (!leftFits && !rightFits) break;

          if (leftFits && (!rightFits || yLeft <= yRight)) {
            pages[pageIdx].push({ ...j, position: { x: 0, y: yLeft } });
            yLeft += j.dimensions.height + gap;
          } else {
            pages[pageIdx].push({ ...j, position: { x: jerseyColX, y: yRight } });
            yRight += j.dimensions.height + gap;
          }
          totalUsedArea += j.dimensions.width * j.dimensions.height;
          jerseyIdx++;
        }
      }

      // Fase 4: jerseys agotados → shorts restantes usan ambas columnas (greedy)
      // Simétrico a Fase 3. El check horizontal evita desborde para shorts muy anchos (XL hombre).
      if (jerseyIdx >= jerseysAsc.length) {
        console.log('[Fase 4] activada | shortIdx:', shortIdx, '/ shortsDesc.length:', shortsDesc.length, '| jerseyColX:', jerseyColX, '| canvasW:', canvasWidth);
        while (shortIdx < shortsDesc.length) {
          const sh = shortsDesc[shortIdx];
          const leftFits  = yLeft  + sh.dimensions.height + gap <= canvasHeight;
          const rightFits = yRight + sh.dimensions.height + gap <= canvasHeight
                            && jerseyColX + sh.dimensions.width <= canvasWidth;
          console.log('[Fase 4] sh.w:', sh.dimensions.width.toFixed(0), '| leftFits:', leftFits, '| rightFits:', rightFits, '| jerseyColX+w:', (jerseyColX + sh.dimensions.width).toFixed(0));

          if (!leftFits && !rightFits) break;

          if (leftFits && (!rightFits || yLeft <= yRight)) {
            pages[pageIdx].push({ ...sh, position: { x: 0, y: yLeft } });
            yLeft += sh.dimensions.height + gap;
          } else {
            pages[pageIdx].push({ ...sh, position: { x: jerseyColX, y: yRight } });
            yRight += sh.dimensions.height + gap;
          }
          totalUsedArea += sh.dimensions.width * sh.dimensions.height;
          shortIdx++;
        }
      }

      // Sin progreso: si yOffset > 0, aún puede haber espacio en la siguiente página.
      // Solo se rompe si ya estamos en y=0 y aun así no cabe → elemento más grande que el canvas.
      if (shortIdx + jerseyIdx === progressBefore) {
        if (yOffset === 0) break;
        pageIdx++;
        pages.push([]);
        yOffset = 0;
        continue;
      }

      yOffset = Math.max(yLeft, yRight);

      if (shortIdx < shortsDesc.length || jerseyIdx < jerseysAsc.length) {
        pageIdx++;
        pages.push([]);
        yOffset = 0;
      }
    }
  }

  // ── Post-proceso: compaction por silueta SVG real ────────────────────────
  if (finalOptions.bitmaps?.size) {
    for (let p = 0; p < pages.length; p++) {
      pages[p] = compactLayout(pages[p], finalOptions);
    }
  }

  const pagesUsed       = pages.length;
  const totalCanvasArea = canvasArea * pagesUsed;
  const efficiency      = (totalUsedArea / totalCanvasArea) * 100;
  const wastedSpace     = totalCanvasArea - totalUsedArea;

  // ── DEBUG TEMPORAL ───────────────────────────────────────────────────────
  console.log('[Layout] resultado → páginas:', pagesUsed, '| elementos por página:', pages.map(p => p.length));
  pages.forEach((p, i) => {
    const shorts = p.filter(el => el.type === 'uniform' && (el as any).part === 'shorts');
    const jerseys = p.filter(el => el.type === 'uniform' && (el as any).part === 'jersey');
    console.log(`  Página ${i + 1}: ${shorts.length} shorts, ${jerseys.length} jerseys`);
    if (p.length > 0) {
      const sizes = [...new Set(p.map(el => (el as any).size))];
      console.log(`    Tallas: ${sizes.join(', ')}`);
      const dims = p.map(el => `${el.dimensions.width.toFixed(0)}×${el.dimensions.height.toFixed(0)}`);
      console.log(`    Dims (primeros 4): ${dims.slice(0,4).join(', ')}`);
    }
  });

  return { pages, efficiency, wastedSpace, pagesUsed, totalElements: elements.length };
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
