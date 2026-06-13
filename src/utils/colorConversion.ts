import convert from 'color-convert';
import {
  getICCProfile,
  type ICCProfileName,
  type GCRMethod,
  applyGCR,
  applyTACLimit,
  applyDotGainCompensation,
} from './iccProfiles';

export interface CMYKConversionOptions {
  profile: ICCProfileName;
  gcrMethod?: GCRMethod;
  customTAC?: number;
  applyDotGain?: boolean;
}

/**
 * Convierte RGB a CMYK usando perfil ICC profesional
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @param options Opciones de conversión
 * @returns Valores CMYK (0-100)
 */
export const rgbToCMYKProfessional = (
  r: number,
  g: number,
  b: number,
  options: CMYKConversionOptions
): { c: number; m: number; y: number; k: number } => {
  // Obtener perfil ICC
  const profile = getICCProfile(options.profile);

  // Conversión básica RGB → CMYK
  let [c, m, y, k] = convert.rgb.cmyk(r, g, b);

  // Aplicar GCR (Gray Component Replacement)
  const gcrMethod = options.gcrMethod || profile.blackGeneration;
  const afterGCR = applyGCR(c, m, y, k, gcrMethod);
  c = afterGCR.c;
  m = afterGCR.m;
  y = afterGCR.y;
  k = afterGCR.k;

  // Aplicar límite de TAC (Total Area Coverage)
  const maxTAC = options.customTAC || profile.maxTAC;
  const afterTAC = applyTACLimit(c, m, y, k, maxTAC);
  c = afterTAC.c;
  m = afterTAC.m;
  y = afterTAC.y;
  k = afterTAC.k;

  // Aplicar compensación de dot gain (opcional)
  if (options.applyDotGain !== false) {
    const afterDotGain = applyDotGainCompensation(c, m, y, k, profile);
    c = afterDotGain.c;
    m = afterDotGain.m;
    y = afterDotGain.y;
    k = afterDotGain.k;
  }

  // Aplicar límite de tinta negra
  k = Math.min(k, profile.blackInkLimit);

  return { c, m, y, k };
};

/**
 * Convierte una imagen RGB a CMYK procesando cada píxel con perfil ICC
 * @param imageDataUrl - Data URL de la imagen en formato RGB
 * @param options - Opciones de conversión ICC
 * @returns Promise con los datos de la imagen en CMYK
 */
export const convertImageRGBtoCMYK = async (
  imageDataUrl: string,
  options: CMYKConversionOptions = { profile: 'FOGRA39' }
): Promise<{
  width: number;
  height: number;
  cmykData: Uint8Array;
  profile: ICCProfileName;
  tac: { min: number; max: number; average: number };
}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto del canvas'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Dibujar la imagen en el canvas
      ctx.drawImage(img, 0, 0);

      // Obtener datos de píxeles RGB
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgbData = imageData.data;

      // Crear array para datos CMYK (4 bytes por píxel)
      const cmykData = new Uint8Array(canvas.width * canvas.height * 4);

      // Estadísticas de TAC
      let minTAC = 400;
      let maxTAC = 0;
      let totalTAC = 0;
      let pixelCount = 0;

      // Convertir cada píxel de RGB a CMYK usando perfil ICC
      for (let i = 0; i < rgbData.length; i += 4) {
        const r = rgbData[i];
        const g = rgbData[i + 1];
        const b = rgbData[i + 2];
        // Alpha channel se ignora en CMYK

        // Convertir RGB a CMYK con perfil ICC profesional
        const { c, m, y, k } = rgbToCMYKProfessional(r, g, b, options);

        // Calcular TAC para este píxel
        const tac = c + m + y + k;
        minTAC = Math.min(minTAC, tac);
        maxTAC = Math.max(maxTAC, tac);
        totalTAC += tac;
        pixelCount++;

        // Almacenar valores CMYK (0-100 convertido a 0-255 para consistencia)
        const pixelIndex = (i / 4) * 4;
        cmykData[pixelIndex] = Math.round((c / 100) * 255);
        cmykData[pixelIndex + 1] = Math.round((m / 100) * 255);
        cmykData[pixelIndex + 2] = Math.round((y / 100) * 255);
        cmykData[pixelIndex + 3] = Math.round((k / 100) * 255);
      }

      resolve({
        width: canvas.width,
        height: canvas.height,
        cmykData,
        profile: options.profile,
        tac: {
          min: minTAC,
          max: maxTAC,
          average: totalTAC / pixelCount,
        },
      });
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = imageDataUrl;
  });
};

/**
 * Convierte un color hexadecimal RGB a valores CMYK con perfil ICC
 * @param hex - Color en formato hexadecimal (#RRGGBB)
 * @param options - Opciones de conversión ICC
 * @returns Objeto con valores CMYK (0-100)
 */
export const hexToCMYK = (
  hex: string,
  options: CMYKConversionOptions = { profile: 'FOGRA39' }
): { c: number; m: number; y: number; k: number } => {
  // Remover # si existe
  const cleanHex = hex.replace('#', '');

  // Convertir hex a RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Convertir RGB a CMYK usando perfil ICC
  return rgbToCMYKProfessional(r, g, b, options);
};

/**
 * Detecta colores fuera de gamut (no reproducibles en CMYK)
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @param options Opciones de conversión
 * @returns true si el color está fuera de gamut
 */
export const isOutOfGamut = (
  r: number,
  g: number,
  b: number,
  options: CMYKConversionOptions
): boolean => {
  const { c, m, y, k } = rgbToCMYKProfessional(r, g, b, options);

  // Si algún valor está saturado (100%) o muy cerca, puede estar fuera de gamut
  const threshold = 98;
  const maxCMY = Math.max(c, m, y);

  // Verificar si el color es muy vibrante (difícil de reproducir en CMYK)
  const isVibrant = maxCMY > threshold && k < 10;

  // Verificar TAC
  const profile = getICCProfile(options.profile);
  const tac = c + m + y + k;
  const tacExceeded = tac > profile.maxTAC;

  return isVibrant || tacExceeded;
};

/**
 * Convierte CMYK de vuelta a RGB (para soft proofing)
 * @param c Cyan (0-100)
 * @param m Magenta (0-100)
 * @param y Yellow (0-100)
 * @param k Black (0-100)
 * @returns RGB values (0-255)
 */
export const cmykToRGB = (
  c: number,
  m: number,
  y: number,
  k: number
): { r: number; g: number; b: number } => {
  const [r, g, b] = convert.cmyk.rgb(c, m, y, k);
  return { r, g, b };
};

export const cmykToHex = (c: number, m: number, y: number, k: number): string => {
  const { r, g, b } = cmykToRGB(c, m, y, k);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
};

/**
 * Simula cómo se verá el color CMYK en papel (soft proofing)
 * @param c Cyan (0-100)
 * @param m Magenta (0-100)
 * @param y Yellow (0-100)
 * @param k Black (0-100)
 * @param paperWhite Color del papel en RGB (default: blanco puro)
 * @returns RGB simulado para visualización
 */
export const simulatePrintedColor = (
  c: number,
  m: number,
  y: number,
  k: number,
  paperWhite: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): { r: number; g: number; b: number } => {
  // Convertir CMYK a RGB
  const { r, g, b } = cmykToRGB(c, m, y, k);

  // Simular el color del papel
  const paperInfluence = 0.1; // 10% de influencia del papel
  const simulatedR = r * (1 - paperInfluence) + paperWhite.r * paperInfluence;
  const simulatedG = g * (1 - paperInfluence) + paperWhite.g * paperInfluence;
  const simulatedB = b * (1 - paperInfluence) + paperWhite.b * paperInfluence;

  return {
    r: Math.round(simulatedR),
    g: Math.round(simulatedG),
    b: Math.round(simulatedB),
  };
};
