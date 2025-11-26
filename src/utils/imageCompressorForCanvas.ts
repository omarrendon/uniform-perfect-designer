/**
 * Comprime imágenes base64 SOLO para visualización en canvas
 * Las imágenes originales se mantienen intactas para la exportación de PDF
 *
 * IMPORTANTE: Esta compresión es SOLO para reducir el uso de memoria en el canvas.
 * Al exportar PDF, se usarán las imágenes originales en alta calidad.
 */

/**
 * Comprime una imagen base64 para visualización en canvas
 * @param base64Image - Imagen en formato base64
 * @param quality - Calidad de compresión (0.1 a 1, default 0.4 = 40%)
 * @returns Promise con la imagen comprimida en base64
 */
export const compressImageForCanvas = (
  base64Image: string,
  quality: number = 0.4
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Crear canvas temporal
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('No se pudo crear el contexto del canvas'));
          return;
        }

        // Reducir dimensiones al 50% (esto reduce el tamaño en ~75%)
        const scaleFactor = 0.5;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convertir a base64 con compresión JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        console.log(`Imagen comprimida: ${(base64Image.length / 1024).toFixed(0)}KB → ${(compressedBase64.length / 1024).toFixed(0)}KB`);

        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen para comprimir'));
    };

    img.src = base64Image;
  });
};

/**
 * Comprime múltiples imágenes en lote
 */
export const compressImagesForCanvas = async (
  images: { [key: string]: string },
  quality: number = 0.4
): Promise<{ [key: string]: string }> => {
  const compressed: { [key: string]: string } = {};

  for (const [key, base64Image] of Object.entries(images)) {
    if (base64Image) {
      try {
        compressed[key] = await compressImageForCanvas(base64Image, quality);
      } catch (error) {
        console.error(`Error comprimiendo imagen ${key}:`, error);
        // Si falla la compresión, usar la original
        compressed[key] = base64Image;
      }
    }
  }

  return compressed;
};
