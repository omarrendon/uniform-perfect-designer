// Web Worker para conversión RGB→CMYK con perfiles ICC.
// Corre fuera del hilo principal → el hilo principal no se bloquea durante
// la conversión pixel-a-pixel de imágenes de alta resolución.

import {
  getICCProfile,
  applyGCR,
  applyTACLimit,
  applyDotGainCompensation,
  type ICCProfileName,
  type GCRMethod,
} from '../utils/iccProfiles';

interface CMYKWorkerRequest {
  id: string;
  imageDataUrl: string;
  options: {
    profile: ICCProfileName;
    gcrMethod?: GCRMethod;
    customTAC?: number;
    applyDotGain?: boolean;
  };
}

interface CMYKWorkerResponse {
  id: string;
  pngDataUrl?: string;
  tac?: { min: number; max: number; average: number };
  error?: string;
}

declare const self: {
  onmessage: ((ev: MessageEvent<CMYKWorkerRequest>) => void) | null;
  postMessage: (message: CMYKWorkerResponse) => void;
};

self.onmessage = async (e: MessageEvent<CMYKWorkerRequest>) => {
  const { id, imageDataUrl, options } = e.data;

  try {
    const result = await convertToCMYK(imageDataUrl, options);
    const response: CMYKWorkerResponse = {
      id,
      pngDataUrl: result.pngDataUrl,
      tac: result.tac,
    };
    self.postMessage(response);
  } catch (err) {
    const response: CMYKWorkerResponse = {
      id,
      error: (err as Error).message,
    };
    self.postMessage(response);
  }
};

async function convertToCMYK(
  imageDataUrl: string,
  options: CMYKWorkerRequest['options'],
): Promise<{ pngDataUrl: string; tac: { min: number; max: number; average: number } }> {
  // Decodificar la imagen usando fetch + createImageBitmap (no existe new Image en workers)
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const { width, height } = bitmap;

  // Dibujar en OffscreenCanvas para obtener los píxeles RGBA
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data; // Uint8ClampedArray RGBA

  // Obtener perfil ICC
  const profile = getICCProfile(options.profile);
  const maxTACLimit = options.customTAC ?? profile.maxTAC;
  const gcrMethod = options.gcrMethod ?? profile.blackGeneration;

  // Estadísticas TAC
  let tacMin = Infinity;
  let tacMax = -Infinity;
  let tacSum = 0;
  let pixelCount = 0;

  // Conversión pixel a pixel RGB → CMYK
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Alpha se preserva sin modificar

    // Fórmula directa RGB → CMYK
    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;
    const k0 = 1 - Math.max(r1, g1, b1);
    const d = k0 < 1 ? 1 - k0 : 1;
    let c = ((1 - r1 - k0) / d) * 100;
    let m = ((1 - g1 - k0) / d) * 100;
    let y = ((1 - b1 - k0) / d) * 100;
    let k = k0 * 100;

    // Aplicar GCR
    const gcr = applyGCR(c, m, y, k, gcrMethod);
    c = gcr.c;
    m = gcr.m;
    y = gcr.y;
    k = gcr.k;

    // Aplicar límite TAC
    const tac = applyTACLimit(c, m, y, k, maxTACLimit);
    c = tac.c;
    m = tac.m;
    y = tac.y;
    k = tac.k;

    // Aplicar compensación de dot gain si está habilitado
    if (options.applyDotGain) {
      const dotGain = applyDotGainCompensation(c, m, y, k, profile);
      c = dotGain.c;
      m = dotGain.m;
      y = dotGain.y;
      k = dotGain.k;
    }

    // Calcular TAC total para estadísticas
    const totalTAC = c + m + y + k;
    if (totalTAC < tacMin) tacMin = totalTAC;
    if (totalTAC > tacMax) tacMax = totalTAC;
    tacSum += totalTAC;
    pixelCount++;

    // Convertir CMYK → RGB para almacenar en el PNG de salida
    // El PDF embedder usará estos valores para embeber; el proceso de embedImageWithCMYK
    // hace la conversión de vuelta al momento de embeber. Aquí devolvemos el PNG
    // con los colores ajustados (compensación aplicada) de vuelta a RGB.
    const factor = (100 - k) / 100;
    data[i] = Math.round((100 - c) / 100 * factor * 255);
    data[i + 1] = Math.round((100 - m) / 100 * factor * 255);
    data[i + 2] = Math.round((100 - y) / 100 * factor * 255);
    // data[i + 3] = alpha — sin cambios
  }

  // Escribir píxeles modificados de vuelta al canvas
  ctx.putImageData(imageData, 0, 0);

  // Convertir a PNG via blob → ArrayBuffer → base64
  const resultBlob = await offscreen.convertToBlob({ type: 'image/png' });
  const buffer = await resultBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const pngDataUrl = `data:image/png;base64,${btoa(binary)}`;

  const tacStats = {
    min: pixelCount > 0 ? tacMin : 0,
    max: pixelCount > 0 ? tacMax : 0,
    average: pixelCount > 0 ? tacSum / pixelCount : 0,
  };

  return { pngDataUrl, tac: tacStats };
}
