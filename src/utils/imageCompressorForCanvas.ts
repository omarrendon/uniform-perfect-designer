// Comprime imágenes base64 SOLO para visualización en canvas.
// Las imágenes originales se mantienen intactas para la exportación de PDF.
//
// Si el navegador soporta OffscreenCanvas, la compresión corre en un Web Worker
// (fuera del hilo principal → la UI nunca se congela).
// En caso contrario, cae al método tradicional con canvas del DOM.

import { getWorkerPool } from './workerPool';

const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

export const compressImageForCanvas = (
  base64Image: string,
  quality: number = 0.4
): Promise<string> => {
  // SVG: pasar sin comprimir — ya es texto optimizado y escala perfectamente
  if (base64Image.startsWith('data:image/svg+xml')) {
    return Promise.resolve(base64Image);
  }
  if (supportsOffscreenCanvas) {
    return getWorkerPool()
      .run(base64Image, quality)
      .catch(() => compressImageMainThread(base64Image, quality)); // fallback si falla el worker
  }
  return compressImageMainThread(base64Image, quality);
};

// Fallback: compresión en el hilo principal (navegadores sin OffscreenCanvas)
function compressImageMainThread(base64Image: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          img.src = '';
          reject(new Error('No se pudo crear el contexto del canvas'));
          return;
        }

        const scaleFactor = 0.5;
        canvas.width = Math.floor(img.width * scaleFactor);
        canvas.height = Math.floor(img.height * scaleFactor);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const result = canvas.toDataURL('image/jpeg', quality);

        canvas.width = 0;
        canvas.height = 0;
        img.src = '';

        resolve(result);
      } catch (error) {
        img.src = '';
        reject(error);
      }
    };

    img.onerror = () => {
      img.src = '';
      reject(new Error('Error al cargar la imagen para comprimir'));
    };

    img.src = base64Image;
  });
}

export const compressImagesForCanvas = async (
  images: { [key: string]: string },
  quality: number = 0.4
): Promise<{ [key: string]: string }> => {
  const entries = Object.entries(images).filter(([, v]) => !!v);
  const results = await Promise.all(
    entries.map(async ([key, base64Image]) => {
      try {
        return [key, await compressImageForCanvas(base64Image, quality)] as const;
      } catch {
        return [key, base64Image] as const;
      }
    })
  );
  return Object.fromEntries(results);
};
