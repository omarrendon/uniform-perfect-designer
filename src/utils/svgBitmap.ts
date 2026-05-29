// Genera máscaras de bitmap para siluetas SVG a baja resolución.
// Se usa en el compaction pass de binPacking para detectar colisiones por forma real
// en lugar de bounding box rectangular.

export const BITMAP_SCALE = 1 / 15; // Jersey M → ~38×53 px
const ALPHA_THRESHOLD = 10;         // Alpha > 10 = píxel no transparente

export interface BitmapMask {
  data: Uint8ClampedArray;  // canal alfa, row-major
  maskW: number;
  maskH: number;
  leftProfile: Int16Array;  // por fila: columna más izquierda ocupada, o maskW si vacía
  rightProfile: Int16Array; // por fila: columna más derecha ocupada + 1, o 0 si vacía
}

// Cache interno: key = "url:width:height[:rotation]"
const _cache = new Map<string, BitmapMask | null>();

function cacheKey(svgUrl: string, realWidth: number, realHeight: number, rotation: number): string {
  const wk = Math.round(realWidth);
  const hk = Math.round(realHeight);
  return rotation !== 0 ? `${svgUrl}:${wk}:${hk}:${rotation}` : `${svgUrl}:${wk}:${hk}`;
}

/**
 * Rasteriza un SVG a escala BITMAP_SCALE y extrae el canal alfa + perfiles de silueta.
 * El resultado se cachea por (url, width, height, rotation).
 */
export async function generateBitmapMask(
  svgUrl: string,
  realWidth: number,
  realHeight: number,
  rotation = 0,
): Promise<BitmapMask | null> {
  const key = cacheKey(svgUrl, realWidth, realHeight, rotation);
  if (_cache.has(key)) return _cache.get(key)!;

  const maskW = Math.max(1, Math.round(realWidth * BITMAP_SCALE));
  const maskH = Math.max(1, Math.round(realHeight * BITMAP_SCALE));

  return new Promise(resolve => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = maskW;
      canvas.height = maskH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        _cache.set(key, null);
        resolve(null);
        return;
      }

      if (rotation === 180) {
        ctx.translate(maskW / 2, maskH / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-maskW / 2, -maskH / 2);
      }

      ctx.drawImage(img, 0, 0, maskW, maskH);

      const { data } = ctx.getImageData(0, 0, maskW, maskH);
      const alpha = new Uint8ClampedArray(maskW * maskH);
      const leftProfile  = new Int16Array(maskH);
      const rightProfile = new Int16Array(maskH);

      for (let r = 0; r < maskH; r++) {
        let left  = maskW; // centinela: fila vacía
        let right = 0;     // centinela: fila vacía
        for (let c = 0; c < maskW; c++) {
          const a = data[(r * maskW + c) * 4 + 3];
          alpha[r * maskW + c] = a;
          if (a > ALPHA_THRESHOLD) {
            if (c < left)  left  = c;
            right = c + 1; // exclusivo
          }
        }
        leftProfile[r]  = left;
        rightProfile[r] = right;
      }

      const mask: BitmapMask = { data: alpha, maskW, maskH, leftProfile, rightProfile };
      _cache.set(key, mask);
      resolve(mask);
    };

    img.onerror = () => {
      _cache.set(key, null);
      resolve(null);
    };

    img.src = svgUrl;
  });
}

export function clearBitmapCache(): void {
  _cache.clear();
}

/**
 * Verifica si dos máscaras se solapan (o están a menos de `gap` píxeles de distancia)
 * dadas sus posiciones en espacio real.
 *
 * Usa perfiles por fila con extensión de gap para detectar tanto solapamiento
 * horizontal como adjacencia vertical.
 */
export function masksOverlap(
  mask1: BitmapMask,
  pos1: { x: number; y: number },
  mask2: BitmapMask,
  pos2: { x: number; y: number },
  gap: number,
): boolean {
  // 1/BITMAP_SCALE = 15 (píxeles reales por píxel de bitmap)
  const inv = 1 / BITMAP_SCALE;

  // Rechazo rápido por bounding box (espacio real, con gap)
  if (pos1.x + mask1.maskW * inv + gap <= pos2.x) return false;
  if (pos2.x + mask2.maskW * inv + gap <= pos1.x) return false;
  if (pos1.y + mask1.maskH * inv + gap <= pos2.y) return false;
  if (pos2.y + mask2.maskH * inv + gap <= pos1.y) return false;

  // Offset de filas: fila de mask2 = fila de mask1 + rowOffset  (en espacio bitmap)
  const rowOffset = (pos1.y - pos2.y) * BITMAP_SCALE;
  const gapBm = Math.ceil(gap * BITMAP_SCALE); // gap en píxeles de bitmap (mín. 1)

  // Iteramos filas de mask1 extendidas por gapBm en ambos lados para capturar
  // adjacencia vertical (cuando mask2 está justo encima o debajo de mask1)
  for (let r1 = -gapBm; r1 < mask1.maskH + gapBm; r1++) {
    // Fila real de mask1 a usar para el perfil (clamped a rango válido)
    const r1c = Math.max(0, Math.min(mask1.maskH - 1, r1));
    if (mask1.rightProfile[r1c] === 0) continue; // fila vacía

    // Fila correspondiente en mask2
    const r2 = Math.round(r1 + rowOffset);
    if (r2 < 0 || r2 >= mask2.maskH) continue;
    if (mask2.leftProfile[r2] === mask2.maskW) continue; // fila vacía en mask2

    // Bordes en espacio real de mask1 (con gap incluido)
    const right1 = pos1.x + mask1.rightProfile[r1c] * inv + gap;
    const left1  = pos1.x + mask1.leftProfile[r1c]  * inv - gap;

    // Bordes en espacio real de mask2
    const left2  = pos2.x + mask2.leftProfile[r2]  * inv;
    const right2 = pos2.x + mask2.rightProfile[r2] * inv;

    if (right1 > left2 && left1 < right2) return true;
  }

  return false;
}
