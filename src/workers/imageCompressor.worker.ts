// Web Worker para compresión de imágenes usando OffscreenCanvas.
// Corre fuera del hilo principal → la UI nunca se congela durante la compresión.

// Tipar self como worker sin necesitar la lib WebWorker en tsconfig
declare const self: {
  onmessage: ((ev: MessageEvent<{ imageBase64: string; quality: number }>) => void) | null;
  postMessage: (message: { result?: string; error?: string }) => void;
};

self.onmessage = async (e) => {
  const { imageBase64, quality } = e.data;
  try {
    const result = await compressImage(imageBase64, quality);
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};

async function compressImage(imageBase64: string, quality: number): Promise<string> {
  // Convertir data URL → Blob (fetch acepta data URLs en workers)
  const response = await fetch(imageBase64);
  const blob = await response.blob();

  // Decodificar sin new Image() (createImageBitmap es async y no bloquea)
  const bitmap = await createImageBitmap(blob);

  const scaleFactor = 0.5;
  const offscreen = new OffscreenCanvas(
    Math.floor(bitmap.width * scaleFactor),
    Math.floor(bitmap.height * scaleFactor)
  );

  const offCtx = offscreen.getContext('2d')!;
  offCtx.drawImage(bitmap, 0, 0, offscreen.width, offscreen.height);
  bitmap.close(); // liberar memoria del ImageBitmap

  const resultBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality });

  // Convertir Blob → base64 (FileReader no existe en workers; usamos arrayBuffer)
  const buffer = await resultBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}
