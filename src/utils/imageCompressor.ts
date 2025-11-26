/**
 * Comprime una imagen a un tamaño más pequeño manteniendo calidad aceptable
 * @param file - Archivo de imagen original
 * @param maxWidth - Ancho máximo de la imagen comprimida
 * @param maxHeight - Alto máximo de la imagen comprimida
 * @param quality - Calidad de compresión (0-1)
 * @returns Promise con la imagen comprimida en base64
 */
export const compressImage = (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Crear canvas para redimensionar
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('No se pudo crear el contexto del canvas'));
          return;
        }

        // Calcular nuevas dimensiones manteniendo aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Configurar canvas
        canvas.width = width;
        canvas.height = height;

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a base64 con compresión
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Calcula el tamaño aproximado de una cadena base64 en KB
 */
export const getBase64Size = (base64: string): number => {
  const base64Length = base64.length - (base64.indexOf(',') + 1);
  const padding = (base64.charAt(base64.length - 2) === '=') ? 2 : ((base64.charAt(base64.length - 1) === '=') ? 1 : 0);
  const sizeInBytes = (base64Length * 0.75) - padding;
  return sizeInBytes / 1024; // Retornar en KB
};
