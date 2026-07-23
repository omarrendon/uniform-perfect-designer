import { toPng } from 'html-to-image';
import { PDFDocument, PDFImage, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { ExportOptions, UniformTemplate, TextElement } from '../types';
import { useDesignerStore } from '../store/desingerStore';
import { convertImageRGBtoCMYK, cmykToHex, type CMYKConversionOptions } from './colorConversion';
import { addPrintMarks, expandPageForMarks, generatePrintFileName } from './printMarks';
import { runPreflight } from './preflight';
import { getGlobalCMYKConfig } from './cmykConfig';
import { CUSTOM_FONTS, loadUserFontFromDataUrl } from './fontLoader';

// Rasteriza un SVG a PNG usando el renderer nativo del browser.
// Para rotation 90°/270°, aplica la rotación durante la rasterización de modo que
// el PNG resultante ya está en la orientación correcta (sin necesidad de rotate en drawImage).
const convertSvgToPng = (url: string, widthPx: number, heightPx: number, rotation = 0): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(widthPx);
      canvas.height = Math.round(heightPx);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      if (rotation === 90) {
        // 90° CW: translate to right edge, rotate, draw at original (swapped) dims
        ctx.translate(widthPx, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0, heightPx, widthPx);
      } else if (rotation === 270) {
        // 270° CW (= 90° CCW): translate to bottom-left, rotate
        ctx.translate(0, widthPx);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, 0, 0, heightPx, widthPx);
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Error rasterizando SVG`));
    img.src = url;
  });


/**
 * Sistema de transformación de coordenadas Canvas (Konva) → PDF
 * Maneja rotaciones y diferencias en sistemas de coordenadas
 */

interface Point {
  x: number;
  y: number;
}

interface TransformConfig {
  canvasHeight: number; // Alto del canvas en puntos PDF
  pixelsPerCm: number;  // Factor de conversión pixels → cm
}

/**
 * Convierte coordenadas de canvas (Konva) a coordenadas PDF para textos
 * Maneja correctamente las rotaciones replicando la transformación de Konva
 *
 * @param canvasPos - Posición absoluta del texto en canvas (píxeles)
 * @param rotation - Rotación en grados (0, 90, 180, 270)
 * @param _textWidth - Ancho del texto en puntos PDF (no usado actualmente, reservado para futuras mejoras)
 * @param fontSize - Tamaño de fuente en puntos PDF
 * @param config - Configuración del canvas (altura, pixelsPerCm)
 * @returns Posición del texto en coordenadas PDF
 */
function canvasTextToPDF(
  canvasPos: Point,
  rotation: number,
  _textWidth: number,
  fontSize: number,
  config: TransformConfig
): Point {
  const { canvasHeight, pixelsPerCm } = config;
  const CM_TO_POINTS = 28.35;

  // Convertir posición de canvas (pixels) a puntos PDF
  const xInCm = canvasPos.x / pixelsPerCm;
  const yInCm = canvasPos.y / pixelsPerCm;
  const xInPoints = xInCm * CM_TO_POINTS;
  const yInPoints = yInCm * CM_TO_POINTS;

  // En canvas (Konva): (x, y) es la esquina superior izquierda del texto
  // En PDF: (x, y) es el punto baseline del texto

  // Diferencia de altura entre top y baseline (aproximadamente 80% del fontSize)
  const baselineOffset = fontSize * 0.8;

  if (rotation === 0) {
    // Sin rotación: conversión directa
    // Canvas: (x, y) = top-left
    // PDF: necesitamos baseline, que está más abajo
    const pdfX = xInPoints;
    const pdfY = canvasHeight - yInPoints - baselineOffset;
    return { x: pdfX, y: pdfY };
  } else if (rotation === 180) {
    // Con rotación 180°:
    // En Konva: el texto rota 180° alrededor de (x, y) que es el top-left
    // Después de rotar, el texto está al revés (de cabeza) y (x, y) sigue siendo el punto de anclaje

    // En PDF: el texto rota alrededor del punto baseline que especificamos
    // Con rotate: 180, el texto se extiende hacia la IZQUIERDA desde el punto especificado

    // Para replicar Konva:
    // 1. En Konva rotado 180°, el punto (x, y) es donde está anclado el texto
    // 2. Después de rotar, visualmente el texto se extiende hacia la izquierda
    // 3. En PDF con rotation=180, el punto que especifico es donde el texto termina (extremo derecho visual)
    // 4. Como el texto se extiende hacia la izquierda, ese punto debe estar en (x, y) de Konva

    const pdfX = xInPoints;
    const pdfY = canvasHeight - yInPoints + baselineOffset;
    return { x: pdfX, y: pdfY };
  }

  // Para otras rotaciones (no implementadas aún)
  const pdfX = xInPoints;
  const pdfY = canvasHeight - yInPoints - baselineOffset;
  return { x: pdfX, y: pdfY };
}

/**
 * Renderiza texto en un canvas HTML y devuelve el PNG como data URL.
 * Base compartida entre la exportación PDF local y la serialización para el servidor.
 */
const renderTextAsPng = async (
  text: string,
  fontFamily: string,
  fontWeight: string,
  fontSizePts: number,
  hexColor: string,
): Promise<{ pngDataUrl: string; widthPts: number; heightPts: number; yOffsetPts: number } | null> => {
  try {
    const SCALE = 3;
    const PTS_TO_CSS_PX = 96 / 72;
    const fontSizeCssPx = fontSizePts * PTS_TO_CSS_PX * SCALE;
    const fontStyle = fontWeight === 'bold' ? 'bold' : 'normal';
    const fontSpec = `${fontStyle} ${fontSizeCssPx}px "${fontFamily}", Arial, sans-serif`;

    const midY = fontSizeCssPx / 2;

    const measureCanvas = document.createElement('canvas');
    measureCanvas.width  = Math.ceil(fontSizeCssPx * text.length * 1.5) + 20;
    measureCanvas.height = Math.ceil(fontSizeCssPx * 2.5);
    const mCtx = measureCanvas.getContext('2d')!;
    mCtx.font = fontSpec;
    mCtx.textBaseline = 'middle';
    const m = mCtx.measureText(text);

    const glyphAbove = Math.ceil(m.actualBoundingBoxAscent)  + 2;
    const glyphBelow = Math.ceil(m.actualBoundingBoxDescent) + 2;
    const extraTop    = Math.max(0, glyphAbove - midY);
    const extraBottom = Math.max(0, glyphBelow - midY);

    const left  = Math.ceil(Math.max(0, -m.actualBoundingBoxLeft)) + 2;
    const right = Math.ceil(m.actualBoundingBoxRight) + 2;

    const w = left + right;
    const h = Math.ceil(fontSizeCssPx) + extraTop + extraBottom;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = w;
    tmpCanvas.height = h;

    const ctx2 = tmpCanvas.getContext('2d')!;
    ctx2.font = fontSpec;
    ctx2.clearRect(0, 0, w, h);

    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    ctx2.fillStyle = `rgb(${r},${g},${b})`;
    ctx2.textBaseline = 'middle';
    ctx2.fillText(text, left, midY + extraTop);

    const pngDataUrl = tmpCanvas.toDataURL('image/png');
    const widthPts   = (w / SCALE) / PTS_TO_CSS_PX;
    const heightPts  = (h / SCALE) / PTS_TO_CSS_PX;
    const yOffsetPts = (extraTop / SCALE) / PTS_TO_CSS_PX;

    return { pngDataUrl, widthPts, heightPts, yOffsetPts };
  } catch {
    return null;
  }
};

/**
 * Renderiza texto en un canvas HTML usando la fuente del navegador y devuelve una imagen PNG
 * embebida en el PDF. Garantiza que cualquier fuente (Google Font, sistema) se renderice
 * correctamente sin problemas de encoding.
 *
 * @returns { pdfImage, widthPts, heightPts } — imagen y dimensiones en puntos PDF, o null si falla
 */
const renderTextAsImage = async (
  pdfDoc: PDFDocument,
  text: string,
  fontFamily: string,
  fontWeight: string,
  fontSizePts: number,
  hexColor: string,
): Promise<{ pdfImage: PDFImage; widthPts: number; heightPts: number; yOffsetPts: number } | null> => {
  const result = await renderTextAsPng(text, fontFamily, fontWeight, fontSizePts, hexColor);
  if (!result) return null;

  try {
    const base64 = result.pngDataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdfImage = await pdfDoc.embedPng(bytes);
    return { pdfImage, widthPts: result.widthPts, heightPts: result.heightPts, yOffsetPts: result.yOffsetPts };
  } catch {
    return null;
  }
};

/**
 * Reemplaza temporalmente las imágenes comprimidas por las originales para exportación
 * @returns Función para restaurar las imágenes comprimidas
 */
const swapToOriginalImages = async (element: HTMLElement): Promise<() => void> => {
  const { uniformSizesConfig, uniformSizesConfigCompressed } = useDesignerStore.getState();

  // Crear mapeo de URLs comprimidas → originales
  const urlMapping = new Map<string, string>();

  Object.keys(uniformSizesConfig).forEach(size => {
    const original = uniformSizesConfig[size];
    const compressed = uniformSizesConfigCompressed[size];

    if (original && compressed) {
      // Mapear cada tipo de imagen
      if (original.jerseyFront && compressed.jerseyFront) {
        urlMapping.set(compressed.jerseyFront, original.jerseyFront);
      }
      if (original.jerseyBack && compressed.jerseyBack) {
        urlMapping.set(compressed.jerseyBack, original.jerseyBack);
      }
      if (original.shortsLeft && compressed.shortsLeft) {
        urlMapping.set(compressed.shortsLeft, original.shortsLeft);
      }
      if (original.shortsRight && compressed.shortsRight) {
        urlMapping.set(compressed.shortsRight, original.shortsRight);
      }
    }
  });

  // Encontrar todas las imágenes en el elemento
  const images = element.querySelectorAll('img');
  const originalSrcs: { img: HTMLImageElement; src: string }[] = [];
  const imagesToLoad: Promise<void>[] = [];

  images.forEach(img => {
    const currentSrc = img.src;
    const originalSrc = urlMapping.get(currentSrc);

    if (originalSrc) {
      // Guardar src original para restaurar después
      originalSrcs.push({ img, src: currentSrc });

      // Crear promesa para esperar a que la imagen original cargue
      const loadPromise = new Promise<void>((resolve) => {
        const newImg = new Image();
        newImg.onload = () => {
          img.src = originalSrc;
          resolve();
        };
        newImg.onerror = () => {
          console.warn(`No se pudo cargar imagen original: ${originalSrc}`);
          resolve(); // Continuar aunque falle
        };
        newImg.src = originalSrc;
      });

      imagesToLoad.push(loadPromise);
    }
  });

  // Esperar a que todas las imágenes originales carguen
  await Promise.all(imagesToLoad);

  // Retornar función de restauración
  return () => {
    originalSrcs.forEach(({ img, src }) => {
      img.src = src;
    });
  };
};

/**
 * Convierte cualquier imagen (JPEG, PNG, etc.) a PNG data URL
 */
const convertToPng = async (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear contexto de canvas'));
        return;
      }

      // Fondo blanco para que las áreas transparentes sean visibles en PDF (fondo blanco)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngDataUrl = canvas.toDataURL('image/png');
      resolve(pngDataUrl);
    };
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = imageDataUrl;
  });
};

/**
 * Crea una imagen CMYK para pdf-lib con validación preflight
 */
const embedImageWithCMYK = async (
  pdfDoc: PDFDocument,
  imageDataUrl: string,
  conversionOptions: CMYKConversionOptions
): Promise<{
  image: PDFImage;
  tacStats: { min: number; max: number; average: number };
  profile: string;
}> => {
  // Convertir imagen a CMYK con perfil ICC profesional
  const cmykData = await convertImageRGBtoCMYK(imageDataUrl, conversionOptions);

  // Convertir a PNG si es necesario (pdf-lib requiere PNG o JPEG específicamente)
  let pngDataUrl = imageDataUrl;
  if (!imageDataUrl.startsWith('data:image/png')) {
    pngDataUrl = await convertToPng(imageDataUrl);
  }

  // Embeber la imagen PNG
  const pdfImage = await pdfDoc.embedPng(pngDataUrl);

  return {
    image: pdfImage,
    tacStats: cmykData.tac,
    profile: cmykData.profile,
  };
};

/**
 * Resuelve la imagen original de un UniformTemplate.
 * Para elementos de carga Excel usa templatePiece + uniformTemplate del store
 * evitando duplicar los datos de imagen en cada elemento.
 */
const resolveOriginalImage = (
  uniform: UniformTemplate,
  uniformTemplate: ReturnType<typeof useDesignerStore.getState>['uniformTemplate'],
): string | undefined => {
  if (uniform.templatePiece && uniformTemplate?.[uniform.templatePiece]) {
    return uniformTemplate[uniform.templatePiece];
  }
  return uniform.originalImageUrl;
};

/**
 * Reemplaza temporalmente las URLs de imágenes en los elementos del canvas
 * para usar las imágenes originales en lugar de las comprimidas
 */
const swapCanvasImagesToOriginal = async (): Promise<() => void> => {
  const store = useDesignerStore.getState();
  const { elements, uniformSizesConfig, uniformSizesConfigCompressed, uniformTemplate, uniformTemplateCompressed } = store;

  // Guardar los imageUrl originales para restaurar después
  const originalImageUrls = new Map<string, string>();

  // Crear mapeo de URLs comprimidas → originales (imágenes manuales por talla)
  const urlMapping = new Map<string, string>();

  Object.keys(uniformSizesConfig).forEach(size => {
    const original = uniformSizesConfig[size];
    const compressed = uniformSizesConfigCompressed[size];

    if (original && compressed) {
      if (original.jerseyFront && compressed.jerseyFront) {
        urlMapping.set(compressed.jerseyFront, original.jerseyFront);
      }
      if (original.jerseyBack && compressed.jerseyBack) {
        urlMapping.set(compressed.jerseyBack, original.jerseyBack);
      }
      if (original.shortsLeft && compressed.shortsLeft) {
        urlMapping.set(compressed.shortsLeft, original.shortsLeft);
      }
      if (original.shortsRight && compressed.shortsRight) {
        urlMapping.set(compressed.shortsRight, original.shortsRight);
      }
    }
  });

  // Mapeo para imágenes cargadas via Excel (template único comprimido → original)
  if (uniformTemplate && uniformTemplateCompressed) {
    const pieces = ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight'] as const;
    for (const piece of pieces) {
      const original = uniformTemplate[piece];
      const compressed = uniformTemplateCompressed[piece];
      if (original && compressed) urlMapping.set(compressed, original);
    }
  }

  // Actualizar elementos uniform con imágenes originales
  elements.forEach(element => {
    if (element.type === 'uniform') {
      const currentImageUrl = element.imageUrl;

      // Skip if no current image URL
      if (!currentImageUrl) return;

      // Intentar obtener la URL original del mapping
      let originalUrl = urlMapping.get(currentImageUrl);

      // Fallback: resolver desde templatePiece o originalImageUrl
      if (!originalUrl) {
        originalUrl = resolveOriginalImage(element as UniformTemplate, uniformTemplate ?? null);
      }

      if (originalUrl && originalUrl !== currentImageUrl) {
        // Guardar la URL actual para restaurar después
        originalImageUrls.set(element.id, currentImageUrl);

        // Actualizar el elemento con la URL original
        store.updateElement(element.id, {
          imageUrl: originalUrl,
        });
      }
    }
  });

  // Retornar función para restaurar las URLs comprimidas
  return () => {
    originalImageUrls.forEach((compressedUrl, elementId) => {
      store.updateElement(elementId, {
        imageUrl: compressedUrl,
      });
    });
  };
};

/**
 * Exporta el canvas como imagen PNG (método antiguo - usa html-to-image)
 * DEPRECADO: Usar exportAsPNGDirect para mejor calidad
 */
export const exportAsPNG = async (
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  let restoreImages: (() => void) | null = null;
  const store = useDesignerStore.getState();

  try {
    // Ocultar textos de talla durante exportación
    store.setIsExporting(true);

    // Esperar a que React re-renderice
    await new Promise(resolve => setTimeout(resolve, 100));

    // Reemplazar imágenes comprimidas por originales en el canvas de Konva
    restoreImages = await swapCanvasImagesToOriginal();

    // Esperar a que Konva re-renderice con las nuevas imágenes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Exportar con imágenes originales
    const dataUrl = await toPng(element, {
      backgroundColor: options.transparent
        ? 'transparent'
        : options.backgroundColor || '#ffffff',
      quality: options.quality || 1,
      pixelRatio: 24, // 600 DPI para impresión ultra profesional (10 × 2.54 × 24 = 609.6 DPI)
    });

    // Descargar la imagen
    const link = document.createElement('a');
    link.download = `uniform-design-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error al exportar PNG:', error);
    throw error;
  } finally {
    // Restaurar imágenes comprimidas
    if (restoreImages) {
      restoreImages();
    }
    // Restaurar visibilidad de textos de talla
    store.setIsExporting(false);
  }
};

/**
 * Asegura que todas las fuentes personalizadas estén cargadas
 */
const ensureCustomFontsLoaded = async (elements: any[]): Promise<void> => {
  const fontsToLoad = new Set<string>();

  // Fuentes del usuario (subidas vía FontUploadButton)
  const { userFonts } = useDesignerStore.getState();
  const userFontMap = new Map(userFonts.map(f => [f.name, f]));

  // Identificar fuentes personalizadas y de usuario usadas
  elements.forEach(element => {
    if (element.type === 'text' && element.fontFamily) {
      if (CUSTOM_FONTS.includes(element.fontFamily as any) || userFontMap.has(element.fontFamily)) {
        fontsToLoad.add(element.fontFamily);
      }
    }
  });

  if (fontsToLoad.size === 0) return;


  // Esperar a que todas las fuentes estén listas
  await document.fonts.ready;

  // Esperar a que todas las fuentes personalizadas estén listas
  const fontPromises = Array.from(fontsToLoad).map(async (fontName) => {
    try {
      // Para fuentes del usuario: rehidratar desde dataUrl si no están en document.fonts
      const userFont = userFontMap.get(fontName);
      if (userFont) {
        const alreadyLoaded = Array.from(document.fonts).some(
          (f: any) => f.family === fontName || f.family.toLowerCase() === fontName.toLowerCase()
        );
        if (!alreadyLoaded) {
          await loadUserFontFromDataUrl(userFont.name, userFont.dataUrl, userFont.format);
        }
        return;
      }

      // Para fuentes personalizadas estáticas: buscar en document.fonts
      const fontFace = Array.from(document.fonts).find(
        (f: any) => f.family === fontName || f.family.toLowerCase() === fontName.toLowerCase()
      );

      if (fontFace) {
        await fontFace.load();
      } else {
        console.warn(`  ⚠️ Fuente "${fontName}" NO encontrada en document.fonts`);
        console.warn(`  📋 Fuentes disponibles:`, Array.from(document.fonts).map((f: any) => f.family));
      }
    } catch (error) {
      console.error(`  ✗ Error al cargar fuente "${fontName}":`, error);
    }
  });

  await Promise.all(fontPromises);
};

/**
 * NUEVA: Exporta como PNG componiendo directamente con imágenes originales
 * Sin usar html-to-image ni Konva, mantiene la calidad completa de las imágenes
 */
export const exportAsPNGDirect = async (
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  try {

    const store = useDesignerStore.getState();
    const elements = store.elements;
    const uniformSizesConfig = store.uniformSizesConfig;

    await ensureCustomFontsLoaded(elements);

    // Configuración de escala para alta resolución
    // Reducir a 5x para evitar problemas de memoria con canvas muy grandes
    const SCALE_FACTOR = 5; // 5x para alta calidad sin exceder límites del navegador

    // PASO 1: Calcular el bounding box de todos los elementos visibles

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const visibleElements = elements.filter(el => el.visible);

    if (visibleElements.length === 0) {
      throw new Error('No hay elementos visibles para exportar');
    }

    // Calcular límites de todos los elementos
    visibleElements.forEach(element => {
      const x = element.position.x;
      const y = element.position.y;
      const width = element.dimensions.width;
      const height = element.dimensions.height;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    // Agregar un margen pequeño (10 píxeles en escala normal)
    const margin = 10;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = maxX + margin;
    maxY = maxY + margin;

    // Calcular dimensiones del bounding box
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;

    // Calcular dimensiones en píxeles con alta resolución (solo el área usada)
    const canvasWidthPx = Math.floor(boundingWidth * SCALE_FACTOR);
    const canvasHeightPx = Math.floor(boundingHeight * SCALE_FACTOR);

    // Verificar límites del navegador
    const MAX_CANVAS_SIZE = 32767; // Límite típico de navegadores
    if (canvasWidthPx > MAX_CANVAS_SIZE || canvasHeightPx > MAX_CANVAS_SIZE) {
      throw new Error(
        `El canvas es demasiado grande: ${canvasWidthPx} × ${canvasHeightPx} px. ` +
        `Máximo permitido: ${MAX_CANVAS_SIZE}px. Reduce las dimensiones del canvas.`
      );
    }

    // Crear canvas HTML5 nativo
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidthPx;
    canvas.height = canvasHeightPx;
    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: options.transparent !== false
    });

    if (!ctx) {
      throw new Error('No se pudo crear contexto 2D del canvas');
    }

    // Configurar canvas para máxima calidad
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fondo blanco (o transparente si se especifica)
    if (!options.transparent) {
      ctx.fillStyle = options.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);
    }

    // Ordenar elementos por zIndex
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    // Procesar cada elemento
    for (const element of sortedElements) {
      if (!element.visible) continue;

      if (element.type === 'uniform') {
        const uniform = element as UniformTemplate;

        // Buscar imagen original
        let originalImageUrl: string | undefined;
        const uniformSizesConfigCompressed = store.uniformSizesConfigCompressed;

        // Buscar en el mapping de uniformSizesConfig
        for (const sizeKey of Object.keys(uniformSizesConfig)) {
          const originalImages = uniformSizesConfig[sizeKey];
          const compressedImages = uniformSizesConfigCompressed[sizeKey];

          if (!originalImages || !compressedImages) continue;

          if (uniform.imageUrl === compressedImages.jerseyFront && originalImages.jerseyFront) {
            originalImageUrl = originalImages.jerseyFront;
            break;
          }
          if (uniform.imageUrl === compressedImages.jerseyBack && originalImages.jerseyBack) {
            originalImageUrl = originalImages.jerseyBack;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsLeft && originalImages.shortsLeft) {
            originalImageUrl = originalImages.shortsLeft;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsRight && originalImages.shortsRight) {
            originalImageUrl = originalImages.shortsRight;
            break;
          }
        }

        // Si no se encontró en el mapping, resolver desde templatePiece o originalImageUrl
        if (!originalImageUrl) {
          originalImageUrl = resolveOriginalImage(uniform, store.uniformTemplate ?? null) || uniform.imageUrl;
        }

        if (originalImageUrl) {

          // Cargar imagen original
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            // No usar crossOrigin para blob URLs y data URLs
            if (!originalImageUrl!.startsWith('blob:') && !originalImageUrl!.startsWith('data:')) {
              image.crossOrigin = 'anonymous';
            }

            image.onload = () => {
              resolve(image);
            };
            image.onerror = (e) => {
              console.error(`    ✗ Error al cargar imagen:`, e);
              reject(new Error(`Error al cargar: ${originalImageUrl}`));
            };
            image.src = originalImageUrl!;
          });

          // Calcular posición y dimensiones escaladas (ajustadas al bounding box)
          const x = (uniform.position.x - minX) * SCALE_FACTOR;
          const y = (uniform.position.y - minY) * SCALE_FACTOR;
          const sw = uniform.dimensions.width * SCALE_FACTOR;   // stored (bounding box) width
          const sh = uniform.dimensions.height * SCALE_FACTOR;  // stored (bounding box) height
          const is90or270 = uniform.rotation === 90 || uniform.rotation === 270;
          const imageW = is90or270 ? sh : sw;
          const imageH = is90or270 ? sw : sh;

          // Guardar estado del contexto
          ctx.save();

          // Aplicar rotación correctamente según el ángulo
          if (uniform.rotation === 90) {
            ctx.translate(x + sw, y);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, 0, 0, imageW, imageH);
          } else if (uniform.rotation === 270) {
            ctx.translate(x, y + sh);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(img, 0, 0, imageW, imageH);
          } else if (uniform.rotation === 180) {
            const centerX = x + sw / 2;
            const centerY = y + sh / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(Math.PI);
            ctx.translate(-centerX, -centerY);
            ctx.drawImage(img, x, y, sw, sh);
          } else {
            ctx.drawImage(img, x, y, sw, sh);
          }

          // Restaurar estado del contexto
          ctx.restore();

          // Agregar texto de talla SOLO si proviene de Excel
          if (uniform.source === 'excel') {
            const tallaText = `Talla ${uniform.size}`;
            const tallaFontSize = 9 * SCALE_FACTOR; // Escalar fuente

            // Guardar estado
            ctx.save();

            // Texto siempre en la parte inferior del bounding box (sin rotar)
            // Para 90°/270° el bounding box ya tiene sw×sh correctos
            const textX = (uniform.position.x - minX) * SCALE_FACTOR;
            const textY = (uniform.position.y - minY) * SCALE_FACTOR + sh - 11 * SCALE_FACTOR;
            const textCenterX = textX + sw / 2;

            // Para rotation=180°, aplicar misma rotación al texto
            if (uniform.rotation === 180) {
              const centerX = (uniform.position.x - minX + uniform.dimensions.width / 2) * SCALE_FACTOR;
              const centerY = (uniform.position.y - minY + uniform.dimensions.height / 2) * SCALE_FACTOR;
              ctx.translate(centerX, centerY);
              ctx.rotate(Math.PI);
              ctx.translate(-centerX, -centerY);
            }

            // Configurar texto
            ctx.font = `bold ${tallaFontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Contorno blanco
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 * SCALE_FACTOR;
            ctx.lineJoin = 'round';
            ctx.strokeText(tallaText, textCenterX, textY);

            // Relleno negro
            ctx.fillStyle = '#000000';
            ctx.fillText(tallaText, textCenterX, textY);

            // Restaurar estado
            ctx.restore();
          }
        }
      } else if (element.type === 'text') {
        const textEl = element as TextElement;

        // Escalar posición y tamaño (ajustadas al bounding box) - SIN offsets por ahora
        // Usar las mismas coordenadas que en el canvas para ver si coinciden
        const x = (textEl.position.x - minX) * SCALE_FACTOR;
        const y = (textEl.position.y - minY) * SCALE_FACTOR;
        const fontSize = textEl.fontSize * SCALE_FACTOR;

        // Guardar estado
        ctx.save();

        // Configurar texto EXACTAMENTE como Konva
        const fontFamily = textEl.fontFamily || 'Arial';
        const isCustomFont = CUSTOM_FONTS.includes(fontFamily as any);

        // Para fuentes personalizadas, NO usar bold (usar normal weight)
        // porque si la fuente no tiene variante bold, el navegador usa Arial como fallback
        const fontWeight = isCustomFont ? 'normal' : (textEl.fontWeight === 'bold' ? 'bold' : 'normal');

        // Para fuentes personalizadas con espacios, necesitamos usar comillas
        const fontFamilyFormatted = fontFamily.includes(' ')
          ? `"${fontFamily}"`
          : fontFamily;

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamilyFormatted}, sans-serif`;
        ctx.fillStyle = textEl.fontColorCmyk
          ? cmykToHex(textEl.fontColorCmyk.c, textEl.fontColorCmyk.m, textEl.fontColorCmyk.y, textEl.fontColorCmyk.k)
          : (textEl.fontColor || '#000000');
        ctx.globalAlpha = textEl.opacity || 1;

        // IMPORTANTE: En Konva sin width, (x,y) es SIEMPRE la esquina superior izquierda
        // El textAlign NO tiene efecto sin width especificado
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Aplicar rotación si es necesario
        if (textEl.rotation !== 0) {
          ctx.translate(x, y);
          ctx.rotate((textEl.rotation * Math.PI) / 180);
          ctx.fillText(textEl.content, 0, 0);
        } else {
          ctx.fillText(textEl.content, x, y);
        }

        // Restaurar estado
        ctx.restore();
      }
    }

    // Verificar que el canvas tenga contenido
    const imageData = ctx.getImageData(0, 0, canvasWidthPx, canvasHeightPx);
    const hasContent = imageData.data.some((value, index) => {
      // Verificar si hay algún pixel que no sea completamente transparente
      if (index % 4 === 3) { // Canal alpha
        return value > 0;
      }
      return false;
    });

    if (!hasContent) {
      throw new Error('El canvas está vacío. No se pudieron cargar las imágenes.');
    }

    // Convertir canvas a PNG de alta calidad
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    // Verificar que el dataURL no esté vacío
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Error al convertir canvas a PNG: dataURL vacío');
    }

    // Descargar la imagen
    const link = document.createElement('a');
    link.download = `uniform-design-HQ-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error al exportar PNG directo:', error);
    throw error;
  }
};

/**
 * Exporta el canvas como PDF con soporte CMYK profesional, marcas de impresión y preflight
 * @param element - Elemento HTML del canvas
 * @param options - Opciones de exportación (incluye canvasWidth y canvasHeight en cm)
 */
export const exportAsPDF = async (
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  let restoreImages: (() => void) | null = null;
  const store = useDesignerStore.getState();

  try {
    // Ocultar textos de talla durante exportación
    store.setIsExporting(true);

    // Esperar a que React re-renderice
    await new Promise(resolve => setTimeout(resolve, 100));

    // Obtener configuración CMYK global
    const cmykConfig = getGlobalCMYKConfig();

    // Reemplazar imágenes comprimidas por originales
    restoreImages = await swapToOriginalImages(element);

    // Exportar con imágenes originales
    const dataUrl = await toPng(element, {
      backgroundColor: options.backgroundColor || '#ffffff',
      quality: options.quality || 1.0,
      pixelRatio: 24, // 600 DPI para impresión ultra profesional
    });

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();

    // Configurar metadata para CMYK
    pdfDoc.setTitle('Uniform Design - CMYK Professional');
    pdfDoc.setAuthor('Uniform Perfect Designer');
    pdfDoc.setSubject(`Diseño de uniformes - Perfil: ${cmykConfig.profile}`);
    pdfDoc.setKeywords(['CMYK', 'Print', 'Uniform', 'Design', cmykConfig.profile]);
    pdfDoc.setProducer('pdf-lib + Professional CMYK Converter');
    pdfDoc.setCreator('Uniform Perfect Designer v2.0');

    // Obtener dimensiones de la imagen
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // Calcular dimensiones en puntos (1 cm = 28.35 points)
    const canvasWidthCm = options.canvasWidth || img.width / 10;
    const canvasHeightCm = options.canvasHeight || img.height / 10;
    const widthInPoints = canvasWidthCm * 28.35;
    const heightInPoints = canvasHeightCm * 28.35;

    // Crear página con dimensiones exactas
    let page = pdfDoc.addPage([widthInPoints, heightInPoints]);

    // Embeber imagen con conversión CMYK usando perfil ICC profesional
    const conversionOptions: CMYKConversionOptions = {
      profile: cmykConfig.profile,
      gcrMethod: cmykConfig.gcrMethod,
      customTAC: cmykConfig.customTAC,
      applyDotGain: cmykConfig.applyDotGain,
    };

    const { image: pdfImage, tacStats, profile } = await embedImageWithCMYK(
      pdfDoc,
      dataUrl,
      conversionOptions
    );

    // Ejecutar validación Preflight
    const preflightResult = await runPreflight(dataUrl, tacStats, {
      ...cmykConfig.preflight,
      profile: cmykConfig.profile,
    });

    if (!preflightResult.passed) {
      console.warn('⚠️ El documento tiene errores de preflight, pero se exportará de todos modos.');
    }

    // Expandir página para marcas de impresión si está habilitado
    if (cmykConfig.printMarks.addCropMarks || cmykConfig.printMarks.addRegistrationMarks) {
      expandPageForMarks(page, cmykConfig.printMarks);
    }

    // Dibujar la imagen ocupando toda la página (ajustado por expansión)
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: widthInPoints,
      height: heightInPoints,
    });

    // Agregar marcas de impresión
    if (cmykConfig.printMarks) {
      await addPrintMarks(pdfDoc, page, {
        ...cmykConfig.printMarks,
        jobInfo: {
          title: 'Uniform Design',
          date: new Date().toLocaleDateString(),
          profile,
          tac: tacStats.max.toFixed(1),
        },
      });
    }

    // Serializar PDF
    const pdfBytes = await pdfDoc.save();

    // Generar nombre de archivo profesional
    const fileName = generatePrintFileName(
      'uniform-design',
      profile,
      tacStats.max
    );

    // Descargar el PDF
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    throw error;
  } finally {
    // Restaurar imágenes comprimidas
    if (restoreImages) {
      restoreImages();
    }
    // Restaurar visibilidad de textos de talla
    store.setIsExporting(false);
  }
};

/**
 * Exporta múltiples páginas como un solo PDF con múltiples hojas (CMYK)
 * @param pages - Array de elementos HTML de cada página del canvas
 * @param options - Opciones de exportación
 */
export const exportMultiPagePDF = async (
  pages: HTMLElement[],
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  const store = useDesignerStore.getState();

  try {
    if (pages.length === 0) {
      throw new Error('No hay páginas para exportar');
    }

    // Ocultar textos de talla durante exportación
    store.setIsExporting(true);

    // Esperar a que React re-renderice
    await new Promise(resolve => setTimeout(resolve, 100));

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();

    // Configurar metadata para CMYK
    pdfDoc.setTitle('Uniform Design - CMYK Multi-Page');
    pdfDoc.setAuthor('Uniform Perfect Designer');
    pdfDoc.setSubject('Diseño de uniformes para impresión (múltiples páginas)');
    pdfDoc.setKeywords(['CMYK', 'Print', 'Uniform', 'Design', 'Multi-Page']);
    pdfDoc.setProducer('pdf-lib + CMYK Converter');
    pdfDoc.setCreator('Uniform Perfect Designer');

    // Usar las dimensiones del canvas en centímetros
    const canvasWidthCm = options.canvasWidth || 100;
    const canvasHeightCm = options.canvasHeight || 100;
    const widthInPoints = canvasWidthCm * 28.35;
    const heightInPoints = canvasHeightCm * 28.35;

    // Procesar cada página
    for (let i = 0; i < pages.length; i++) {
      const pageElement = pages[i];
      let restoreImages: (() => void) | null = null;

      try {
        // Reemplazar imágenes comprimidas por originales para esta página
        restoreImages = await swapToOriginalImages(pageElement);

        // Convertir la página a imagen con imágenes originales
        const dataUrl = await toPng(pageElement, {
          backgroundColor: options.backgroundColor || '#ffffff',
          quality: options.quality || 1.0,
          pixelRatio: 24, // 600 DPI para impresión ultra profesional
        });

        // Restaurar imágenes comprimidas inmediatamente después de capturar
        if (restoreImages) {
          restoreImages();
          restoreImages = null;
        }

        // Obtener configuración CMYK
        const cmykConfig = getGlobalCMYKConfig();
        const conversionOptions: CMYKConversionOptions = {
          profile: cmykConfig.profile,
          gcrMethod: cmykConfig.gcrMethod,
          customTAC: cmykConfig.customTAC,
          applyDotGain: cmykConfig.applyDotGain,
        };

        // Crear nueva página en el PDF
        const page = pdfDoc.addPage([widthInPoints, heightInPoints]);

        // Embeber imagen con conversión CMYK
        const { image: pdfImage } = await embedImageWithCMYK(pdfDoc, dataUrl, conversionOptions);

        // Dibujar la imagen ocupando toda la página
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width: widthInPoints,
          height: heightInPoints,
        });
      } finally {
        // Asegurar que se restauren las imágenes incluso si hay error
        if (restoreImages) {
          restoreImages();
        }
      }
    }

    // Serializar PDF
    const pdfBytes = await pdfDoc.save();

    // Descargar el PDF
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `uniform-design-CMYK-multipage-${Date.now()}.pdf`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al exportar PDF multipágina:', error);
    throw error;
  } finally {
    // Restaurar visibilidad de textos de talla
    store.setIsExporting(false);
  }
};

/**
 * NUEVA: Exporta como PDF componiendo directamente con imágenes originales
 * Sin usar html-to-image, mantiene la calidad completa de las imágenes
 */
export const exportAsPDFDirect = async (
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  try {

    // Obtener configuración CMYK global
    const cmykConfig = getGlobalCMYKConfig();

    // Obtener elementos y configuración del store
    const store = useDesignerStore.getState();
    const elements = store.elements; // Elementos de la página actual
    const canvasConfig = store.canvasConfig;
    const uniformSizesConfig = store.uniformSizesConfig;

    // Calcular dimensiones en puntos (1 cm = 28.35 points)
    const canvasWidthCm = options.canvasWidth || canvasConfig.width;
    const canvasHeightCm = options.canvasHeight || canvasConfig.height;
    const widthInPoints = canvasWidthCm * 28.35;
    const heightInPoints = canvasHeightCm * 28.35;

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();

    // Configurar metadata
    pdfDoc.setTitle('Uniform Design - CMYK Professional Direct');
    pdfDoc.setAuthor('Uniform Perfect Designer');
    pdfDoc.setSubject(`Diseño de uniformes - Perfil: ${cmykConfig.profile}`);
    pdfDoc.setKeywords(['CMYK', 'Print', 'Uniform', 'Design', cmykConfig.profile]);
    pdfDoc.setProducer('pdf-lib + Professional CMYK Direct Composer');
    pdfDoc.setCreator('Uniform Perfect Designer v2.1 Direct');

    // Crear página
    let page = pdfDoc.addPage([widthInPoints, heightInPoints]);

    // Fuente para etiquetas de talla (Helvetica Bold embebido)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Estadísticas de TAC
    let maxTAC = 0;
    let avgTAC = 0;
    let tacCount = 0;

    // Ordenar elementos por zIndex
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    // Procesar cada elemento
    for (const element of sortedElements) {
      if (!element.visible) continue;

      if (element.type === 'uniform') {
        const uniform = element as UniformTemplate;

        // Buscar imagen original en el store
        let originalImageUrl: string | undefined;

        // Crear mapeo de imágenes comprimidas → originales
        const uniformSizesConfigCompressed = store.uniformSizesConfigCompressed;

        for (const sizeKey of Object.keys(uniformSizesConfig)) {
          const originalImages = uniformSizesConfig[sizeKey];
          const compressedImages = uniformSizesConfigCompressed[sizeKey];

          if (!originalImages || !compressedImages) continue;

          // Comparar con la imagen COMPRIMIDA que está en imageUrl
          if (uniform.imageUrl === compressedImages.jerseyFront && originalImages.jerseyFront) {
            originalImageUrl = originalImages.jerseyFront;
            break;
          }
          if (uniform.imageUrl === compressedImages.jerseyBack && originalImages.jerseyBack) {
            originalImageUrl = originalImages.jerseyBack;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsLeft && originalImages.shortsLeft) {
            originalImageUrl = originalImages.shortsLeft;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsRight && originalImages.shortsRight) {
            originalImageUrl = originalImages.shortsRight;
            break;
          }
        }

        // Si no se encontró en el mapeo, resolver desde templatePiece o originalImageUrl
        if (!originalImageUrl) {
          originalImageUrl = resolveOriginalImage(uniform, store.uniformTemplate ?? null) || uniform.imageUrl;
        }

        if (originalImageUrl) {

          // Calcular posición y dimensiones en puntos
          const xInCm = uniform.position.x / canvasConfig.pixelsPerCm;
          const yInCm = uniform.position.y / canvasConfig.pixelsPerCm;
          const widthInCm = uniform.dimensions.width / canvasConfig.pixelsPerCm;
          const heightInCm = uniform.dimensions.height / canvasConfig.pixelsPerCm;

          const xInPoints = xInCm * 28.35;
          const yInPoints = yInCm * 28.35;
          const widthInPts = widthInCm * 28.35;
          const heightInPts = heightInCm * 28.35;

          const pdfYBottom = heightInPoints - yInPoints - heightInPts;

          // SVG: rasterizar a alta resolución via browser (renderiza completo: <image>, máscaras, gradientes)
          // Para 90°/270°, la rotación se aplica durante la rasterización — no en drawImage
          // PNG/JPEG: usar directamente con conversión CMYK
          const SVG_PDF_SCALE = 4; // ~288 DPI para SVGs de 72 DPI nativo
          const imageUrlForEmbed = originalImageUrl.startsWith('data:image/svg+xml')
            ? await convertSvgToPng(originalImageUrl, widthInPts * SVG_PDF_SCALE, heightInPts * SVG_PDF_SCALE, uniform.rotation)
            : originalImageUrl;

          const conversionOptions: CMYKConversionOptions = {
            profile: cmykConfig.profile,
            gcrMethod: cmykConfig.gcrMethod,
            customTAC: cmykConfig.customTAC,
            applyDotGain: cmykConfig.applyDotGain,
          };

          const { image: pdfImage, tacStats } = await embedImageWithCMYK(pdfDoc, imageUrlForEmbed, conversionOptions);

          maxTAC = Math.max(maxTAC, tacStats.max);
          avgTAC += tacStats.average;
          tacCount++;

          let pdfY = pdfYBottom;
          let pdfX = xInPoints;
          // For 90°/270°, the SVG is pre-rotated — draw without rotation
          // For 180°, adjust anchor point for pdf-lib's bottom-left rotation pivot
          if (uniform.rotation === 180) { pdfX = xInPoints + widthInPts; pdfY = pdfYBottom + heightInPts; }
          const pdfRotation = (uniform.rotation === 90 || uniform.rotation === 270) ? 0 : uniform.rotation;

          page.drawImage(pdfImage, { x: pdfX, y: pdfY, width: widthInPts, height: heightInPts, rotate: degrees(pdfRotation) });

          // Agregar texto de talla SOLO si proviene de Excel
          if (uniform.source === 'excel') {
            const tallaText = `Talla ${uniform.size}`;
            const tallaFontSize = 9; // Mismo tamaño que en UniformElement.tsx
            const tallaFontSizeInPoints = (tallaFontSize / canvasConfig.pixelsPerCm) * 28.35;

            // Posición del texto RELATIVA al uniforme (como en canvas)
            // En canvas (UniformElement.tsx): x=0, y=dimensions.height-11, width=dimensions.width, align="center"
            // El texto se centra horizontalmente en el ancho del uniforme
            const tallaRelativeY = uniform.dimensions.height - 11;
            const tallaRelativeX = uniform.dimensions.width / 2; // Centro del uniforme

            // Calcular posición absoluta considerando la rotación del uniform
            let tallaAbsoluteX: number;
            let tallaAbsoluteY: number;

            if (uniform.rotation === 180) {
              // En UniformElement.tsx, cuando rotation != 0, el Group tiene offsets:
              // offsetX = dimensions.width / 2, offsetY = dimensions.height / 2
              // El Group rota alrededor de su centro, no de su esquina superior izquierda

              // Centro de rotación del uniform (en coordenadas canvas)
              const centerX = uniform.position.x + uniform.dimensions.width / 2;
              const centerY = uniform.position.y + uniform.dimensions.height / 2;

              // Posición del texto relativa al centro del uniform
              const relX = tallaRelativeX - uniform.dimensions.width / 2;
              const relY = tallaRelativeY - uniform.dimensions.height / 2;

              // Aplicar rotación de 180° alrededor del centro
              const angleRad = (uniform.rotation * Math.PI) / 180;
              const rotatedRelX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad);
              const rotatedRelY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad);

              // Convertir de vuelta a coordenadas absolutas
              tallaAbsoluteX = centerX + rotatedRelX;
              tallaAbsoluteY = centerY + rotatedRelY;
            } else {
              // Sin rotación, simplemente sumar posiciones
              tallaAbsoluteX = uniform.position.x + tallaRelativeX;
              tallaAbsoluteY = uniform.position.y + tallaRelativeY;
            }

            // Calcular ancho del texto
            const textWidth = fontBold.widthOfTextAtSize(tallaText, tallaFontSizeInPoints);

            // Usar función de transformación matricial para convertir coordenadas
            const tallaPdfPos = canvasTextToPDF(
              { x: tallaAbsoluteX, y: tallaAbsoluteY },
              uniform.rotation,
              textWidth,
              tallaFontSizeInPoints,
              { canvasHeight: heightInPoints, pixelsPerCm: canvasConfig.pixelsPerCm }
            );

            // Ajustar para centrado del texto (en canvas usa align="center", en PDF manual)
            let tallaPdfX = tallaPdfPos.x - textWidth / 2;
            let tallaPdfY = tallaPdfPos.y;

            // Para rotación 180°, el centrado funciona al revés
            if (uniform.rotation === 180) {
              tallaPdfX = tallaPdfPos.x + textWidth / 2;
            }

            // Para 90°/270°, el SVG fue pre-rotado — el texto no necesita rotación adicional
            const tallaTextRotation = (uniform.rotation === 90 || uniform.rotation === 270) ? 0 : uniform.rotation;
            const tallaOutlineOpts = { size: tallaFontSizeInPoints, font: fontBold, color: rgb(1, 1, 1), rotate: degrees(tallaTextRotation) };
            const outlineOffsets = [-0.5, 0, 0.5];
            for (const dx of outlineOffsets) {
              for (const dy of outlineOffsets) {
                if (dx !== 0 || dy !== 0) {
                  page.drawText(tallaText, { ...tallaOutlineOpts, x: tallaPdfX + dx, y: tallaPdfY + dy });
                }
              }
            }
            page.drawText(tallaText, {
              x: tallaPdfX,
              y: tallaPdfY,
              size: tallaFontSizeInPoints,
              font: fontBold,
              color: rgb(0, 0, 0),
              rotate: degrees(tallaTextRotation),
            });
          }
        }
      } else if (element.type === 'text') {
        const textEl = element as TextElement;

        const fontSizeInPoints = (textEl.fontSize / canvasConfig.pixelsPerCm) * 28.35;
        const hexColor = textEl.fontColorCmyk
          ? cmykToHex(textEl.fontColorCmyk.c, textEl.fontColorCmyk.m, textEl.fontColorCmyk.y, textEl.fontColorCmyk.k)
          : (textEl.fontColor || '#000000');

        // Renderizar texto como imagen PNG usando el navegador (garantiza fuente correcta)
        const textImg = await renderTextAsImage(
          pdfDoc,
          textEl.content,
          textEl.fontFamily || 'Arial',
          textEl.fontWeight || 'normal',
          fontSizeInPoints,
          hexColor,
        );

        if (textImg) {
          // Posición top-left en PDF (y invertido: PDF origin=bottom-left)
          // yOffsetPts compensa el espacio transparente superior de la imagen
          const xInPts = (textEl.position.x / canvasConfig.pixelsPerCm) * 28.35;
          const yInPts = (textEl.position.y / canvasConfig.pixelsPerCm) * 28.35;
          let pdfX = xInPts;
          let pdfY = heightInPoints - yInPts - textImg.heightPts + textImg.yOffsetPts;

          // Replicar el centrado de Konva: TextElement.tsx pasa width al nodo Konva solo
          // cuando dimensions.width > 450, activando textAlign='center' dentro de ese ancho.
          // Sin esta corrección, el PDF coloca el texto en el borde izquierdo del nodo
          // en lugar de centrarlo, como ocurre con el nombre en la playera trasera.
          if (textEl.textAlign === 'center' && textEl.dimensions.width > 450) {
            const dimWidthPts = (textEl.dimensions.width / canvasConfig.pixelsPerCm) * 28.35;
            pdfX += (dimWidthPts - textImg.widthPts) / 2;
          }

          // Alinear textos rotation=180° entre Konva y PDF.
          // En Konva, rotation=180° rota alrededor del top-left del nodo: el contenido
          // va hacia ARRIBA e IZQUIERDA desde el anchor (cx, cy).
          // pdf-lib hace translate(pdfX,pdfY) → rotate(180°) → scale(w,h), por lo que
          // la imagen ocupa PDF x∈[pdfX-w, pdfX] e y∈[pdfY-h, pdfY].
          // Para que canvas x=[cx-w,cx] e y=[cy-h,cy] coincidan:
          //   pdfX = xInPts  (la imagen irá de xInPts-w a xInPts)
          //   pdfY = H - yInPts + heightPts - yOffsetPts
          if (textEl.rotation === 180) {
            const baseX = xInPts;
            if (textEl.textAlign === 'center' && textEl.dimensions.width > 450) {
              const dimWidthPts = (textEl.dimensions.width / canvasConfig.pixelsPerCm) * 28.35;
              pdfX = baseX - (dimWidthPts - textImg.widthPts) / 2;
            } else {
              pdfX = baseX;
            }
            pdfY = heightInPoints - yInPts + textImg.heightPts - textImg.yOffsetPts;
          }

          page.drawImage(textImg.pdfImage, {
            x: pdfX,
            y: pdfY,
            width:  textImg.widthPts,
            height: textImg.heightPts,
            opacity: textEl.opacity,
            rotate: degrees(textEl.rotation),
          });
        }
      }
    }

    // Calcular TAC promedio
    avgTAC = tacCount > 0 ? avgTAC / tacCount : 0;

    const tacStats = { min: 0, max: maxTAC, average: avgTAC };

    // Ejecutar validación Preflight
    await runPreflight('', tacStats, {
      ...cmykConfig.preflight,
      profile: cmykConfig.profile,
    });

    // Expandir página para marcas de impresión
    if (cmykConfig.printMarks.addCropMarks || cmykConfig.printMarks.addRegistrationMarks) {
      expandPageForMarks(page, cmykConfig.printMarks);
    }

    // Agregar marcas de impresión
    if (cmykConfig.printMarks) {
      await addPrintMarks(pdfDoc, page, {
        ...cmykConfig.printMarks,
        jobInfo: {
          title: 'Uniform Design Direct',
          date: new Date().toLocaleDateString(),
          profile: cmykConfig.profile,
          tac: tacStats.max.toFixed(1),
        },
      });
    }

    // Serializar PDF
    const pdfBytes = await pdfDoc.save();

    // Generar nombre de archivo
    const fileName = generatePrintFileName(
      'uniform-design-direct',
      cmykConfig.profile,
      tacStats.max
    );

    // Descargar el PDF
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al exportar PDF directo:', error);
    throw error;
  }
};


/**
 * Procesa una imagen en un Web Worker dedicado para conversión CMYK.
 * El worker corre en un hilo separado → no bloquea el hilo principal durante
 * la conversión pixel-a-pixel.
 */
const processImageWithWorker = (
  imageUrl: string,
  options: CMYKConversionOptions,
): Promise<{ pngDataUrl: string; tac: { min: number; max: number; average: number } }> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/cmykWorker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve({ pngDataUrl: e.data.pngDataUrl, tac: e.data.tac });
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage({
      id: imageUrl,
      imageDataUrl: imageUrl,
      options: {
        profile: options.profile,
        gcrMethod: options.gcrMethod,
        customTAC: options.customTAC,
        applyDotGain: options.applyDotGain,
      },
    });
  });

/**
 * Exporta múltiples páginas como PDFs separados usando composición directa
 */
export const exportMultiPagePDFDirect = async (
  options: Partial<ExportOptions> & {
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<void> => {
  try {
    const store = useDesignerStore.getState();
    const totalPages = store.pages.length;
    const canvasConfig = store.canvasConfig;
    const cmykConfig = getGlobalCMYKConfig();

    // OPTIMIZACIÓN: Pre-procesar y cachear datos de imágenes CMYK

    const uniformSizesConfig = store.uniformSizesConfig;
    const uniformSizesConfigCompressed = store.uniformSizesConfigCompressed;

    // Identificar todas las imágenes únicas
    const uniqueImages = new Set<string>();

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const elements = store.pages[pageIndex] || [];

      for (const element of elements) {
        if (!element.visible || element.type !== 'uniform') continue;

        const uniform = element as UniformTemplate;
        let originalImageUrl: string | undefined;

        // Buscar imagen original
        for (const sizeKey of Object.keys(uniformSizesConfig)) {
          const originalImages = uniformSizesConfig[sizeKey];
          const compressedImages = uniformSizesConfigCompressed[sizeKey];

          if (!originalImages || !compressedImages) continue;

          if (uniform.imageUrl === compressedImages.jerseyFront && originalImages.jerseyFront) {
            originalImageUrl = originalImages.jerseyFront;
            break;
          }
          if (uniform.imageUrl === compressedImages.jerseyBack && originalImages.jerseyBack) {
            originalImageUrl = originalImages.jerseyBack;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsLeft && originalImages.shortsLeft) {
            originalImageUrl = originalImages.shortsLeft;
            break;
          }
          if (uniform.imageUrl === compressedImages.shortsRight && originalImages.shortsRight) {
            originalImageUrl = originalImages.shortsRight;
            break;
          }
        }

        if (!originalImageUrl) {
          originalImageUrl = resolveOriginalImage(uniform, store.uniformTemplate ?? null) || uniform.imageUrl;
        }

        if (originalImageUrl) {
          uniqueImages.add(originalImageUrl);
        }
      }
    }

    const conversionOptions: CMYKConversionOptions = {
      profile: cmykConfig.profile,
      gcrMethod: cmykConfig.gcrMethod,
      customTAC: cmykConfig.customTAC,
      applyDotGain: cmykConfig.applyDotGain,
    };

    // Pre-convertir todas las imágenes únicas a PNG y calcular TAC stats
    const imagePngCache = new Map<string, string>(); // URL original -> PNG dataURL
    const imageTacCache = new Map<string, { min: number; max: number; average: number }>(); // URL original -> TAC stats

    // Procesar imágenes no-SVG en paralelo usando Web Workers (una imagen por worker)
    const nonSvgUrls = Array.from(uniqueImages).filter(url => !url.startsWith('data:image/svg+xml'));
    await Promise.all(
      nonSvgUrls.map(async (url) => {
        try {
          const { pngDataUrl, tac } = await processImageWithWorker(url, conversionOptions);
          imagePngCache.set(url, pngDataUrl);
          imageTacCache.set(url, tac);
        } catch {
          // Fallback al hilo principal si el worker falla
          const pngDataUrl = url.startsWith('data:image/png') ? url : await convertToPng(url);
          imagePngCache.set(url, pngDataUrl);
          const cmykData = await convertImageRGBtoCMYK(url, conversionOptions);
          imageTacCache.set(url, cmykData.tac);
        }
      })
    );

    // Estadísticas
    let totalImagesEmbedded = 0;
    let totalImagesFromCache = 0;

    // Caché de PNG independiente para el loop de renderizado
    // Persiste entre páginas para evitar reconversiones, pero es INDEPENDIENTE
    // de imagePngCache (que puede tener datos obsoletos del pre-caché)
    const renderPngCache = new Map<string, string>();

    // Procesar cada página como un PDF separado
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {

      // Actualizar progreso
      if (options.onProgress) {
        options.onProgress(pageIndex + 1, totalPages);
      }

      // Crear un NUEVO PDFDocument para esta página (regla de negocio: un archivo por página)
      const pdfDoc = await PDFDocument.create();

      // Fuente para etiquetas de talla (Helvetica Bold embebido)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Obtener elementos de esta página directamente
      const elements = store.pages[pageIndex] || [];

      // Obtener altura de la página
      const pageHeightCm = store.getPageHeight(pageIndex);

      // Calcular dimensiones en puntos
      const canvasWidthCm = options.canvasWidth || canvasConfig.width;
      const widthInPoints = canvasWidthCm * 28.35;
      const heightInPoints = pageHeightCm * 28.35;

      // Agregar página al documento
      const page = pdfDoc.addPage([widthInPoints, heightInPoints]);

      // Caché de imagen embebida por página — evita reconvertir CMYK para el mismo template SVG
      const svgEmbedCache = new Map<string, { pdfImage: PDFImage; tacStats: { min: number; max: number; average: number } }>();
      // Caché de PDFImage para PNG/JPEG — evita re-embeber la misma imagen dentro de una página
      const pngEmbedCache = new Map<string, PDFImage>();

      // Estadísticas de TAC
      let maxTAC = 0;
      let avgTAC = 0;
      let tacCount = 0;

      // Ordenar elementos por zIndex
      const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

      // Procesar cada elemento
      for (const element of sortedElements) {
        if (!element.visible) continue;

        if (element.type === 'uniform') {
          const uniform = element as UniformTemplate;

          // Buscar imagen original con mapeo correcto
          let originalImageUrl: string | undefined;
          const uniformSizesConfigCompressed = store.uniformSizesConfigCompressed;

          for (const sizeKey of Object.keys(uniformSizesConfig)) {
            const originalImages = uniformSizesConfig[sizeKey];
            const compressedImages = uniformSizesConfigCompressed[sizeKey];

            if (!originalImages || !compressedImages) continue;

            // Comparar con la imagen COMPRIMIDA
            if (uniform.imageUrl === compressedImages.jerseyFront && originalImages.jerseyFront) {
              originalImageUrl = originalImages.jerseyFront;
              break;
            }
            if (uniform.imageUrl === compressedImages.jerseyBack && originalImages.jerseyBack) {
              originalImageUrl = originalImages.jerseyBack;
              break;
            }
            if (uniform.imageUrl === compressedImages.shortsLeft && originalImages.shortsLeft) {
              originalImageUrl = originalImages.shortsLeft;
              break;
            }
            if (uniform.imageUrl === compressedImages.shortsRight && originalImages.shortsRight) {
              originalImageUrl = originalImages.shortsRight;
              break;
            }
          }

          if (!originalImageUrl) {
            originalImageUrl = resolveOriginalImage(uniform, store.uniformTemplate ?? null) || uniform.imageUrl;
          }

          if (originalImageUrl) {
            // Calcular posición y dimensiones (común para SVG y PNG)
            const xInCm = uniform.position.x / canvasConfig.pixelsPerCm;
            const yInCm = uniform.position.y / canvasConfig.pixelsPerCm;
            const widthInCm = uniform.dimensions.width / canvasConfig.pixelsPerCm;
            const heightInCm = uniform.dimensions.height / canvasConfig.pixelsPerCm;

            const xInPoints = xInCm * 28.35;
            const yInPoints = yInCm * 28.35;
            const widthInPts = widthInCm * 28.35;
            const heightInPts = heightInCm * 28.35;

            const pdfYBottom = heightInPoints - yInPoints - heightInPts;
            const pdfX = xInPoints;

            if (originalImageUrl.startsWith('data:image/svg+xml')) {
              // SVG: rasterizar via browser a alta resolución.
              // Para 90°/270°, la rotación se aplica durante la rasterización — no en drawImage.
              const SVG_PDF_SCALE = 4;
              const svgCacheKey = `${originalImageUrl}:${uniform.rotation}`;
              let pngDataUrl = renderPngCache.get(svgCacheKey);
              if (!pngDataUrl) {
                pngDataUrl = await convertSvgToPng(originalImageUrl, widthInPts * SVG_PDF_SCALE, heightInPts * SVG_PDF_SCALE, uniform.rotation);
                renderPngCache.set(svgCacheKey, pngDataUrl);
              }
              let svgCached = svgEmbedCache.get(svgCacheKey);
              if (!svgCached) {
                const embedded = await embedImageWithCMYK(pdfDoc, pngDataUrl, conversionOptions);
                svgCached = { pdfImage: embedded.image, tacStats: embedded.tacStats };
                svgEmbedCache.set(svgCacheKey, svgCached);
              }
              const { pdfImage, tacStats } = svgCached;
              maxTAC = Math.max(maxTAC, tacStats.max);
              avgTAC += tacStats.average;
              tacCount++;

              let pdfY = pdfYBottom;
              let adjustedPdfX = pdfX;
              // For 90°/270°, SVG is pre-rotated — draw without rotation
              if (uniform.rotation === 180) { adjustedPdfX = xInPoints + widthInPts; pdfY = pdfYBottom + heightInPts; }
              const svgPdfRotation = (uniform.rotation === 90 || uniform.rotation === 270) ? 0 : uniform.rotation;
              page.drawImage(pdfImage, { x: adjustedPdfX, y: pdfY, width: widthInPts, height: heightInPts, rotate: degrees(svgPdfRotation) });
              totalImagesEmbedded++;
            } else {
              // PNG/JPEG: usar caché de renderizado (independiente del pre-caché)
              // renderPngCache se declara al inicio del loop de páginas para persistir entre páginas
              let pngDataUrl = renderPngCache.get(originalImageUrl);
              if (!pngDataUrl) {
                // También intentar desde el pre-caché si tiene datos
                pngDataUrl = imagePngCache.get(originalImageUrl);
              }
              const tacStats = imageTacCache.get(originalImageUrl);

              if (!pngDataUrl) {
                try {
                  pngDataUrl = originalImageUrl.startsWith('data:image/png')
                    ? originalImageUrl
                    : await convertToPng(originalImageUrl);
                  renderPngCache.set(originalImageUrl, pngDataUrl);
                  imagePngCache.set(originalImageUrl, pngDataUrl);
                } catch (convErr) {
                  console.error(`  ✗ Error convirtiendo imagen:`, convErr);
                  continue;
                }
              }

              let pdfImage = pngEmbedCache.get(pngDataUrl);
              if (!pdfImage) {
                pdfImage = await pdfDoc.embedPng(pngDataUrl);
                pngEmbedCache.set(pngDataUrl, pdfImage);
              }
              totalImagesEmbedded++;
              totalImagesFromCache++;

              if (tacStats) {
                maxTAC = Math.max(maxTAC, tacStats.max);
                avgTAC += tacStats.average;
                tacCount++;
              }

              let pdfY = pdfYBottom;
              let adjustedPdfX = pdfX;

              // Ajustar posición para rotación de 180° (short derecho)
              if (uniform.rotation === 180) {
                adjustedPdfX = xInPoints + widthInPts;
                pdfY = pdfYBottom + heightInPts;
              }

              page.drawImage(pdfImage, {
                x: adjustedPdfX,
                y: pdfY,
                width: widthInPts,
                height: heightInPts,
                rotate: degrees(uniform.rotation),
              });
            }

            // Agregar texto de talla SOLO si proviene de Excel
            if (uniform.source === 'excel') {
              const tallaText = `Talla ${uniform.size}`;
              const tallaFontSize = 9; // Mismo tamaño que en UniformElement.tsx
              const tallaFontSizeInPoints = (tallaFontSize / canvasConfig.pixelsPerCm) * 28.35;

              // Posición del texto RELATIVA al uniforme (como en canvas)
              // En canvas (UniformElement.tsx): x=0, y=dimensions.height-11, width=dimensions.width, align="center"
              // El texto se centra horizontalmente en el ancho del uniforme
              const tallaRelativeY = uniform.dimensions.height - 11;
              const tallaRelativeX = uniform.dimensions.width / 2; // Centro del uniforme

              // Calcular posición absoluta considerando la rotación del uniform
              let tallaAbsoluteX: number;
              let tallaAbsoluteY: number;

              if (uniform.rotation === 180) {
                // En UniformElement.tsx, cuando rotation != 0, el Group tiene offsets:
                // offsetX = dimensions.width / 2, offsetY = dimensions.height / 2
                // El Group rota alrededor de su centro, no de su esquina superior izquierda

                // Centro de rotación del uniform (en coordenadas canvas)
                const centerX = uniform.position.x + uniform.dimensions.width / 2;
                const centerY = uniform.position.y + uniform.dimensions.height / 2;

                // Posición del texto relativa al centro del uniform
                const relX = tallaRelativeX - uniform.dimensions.width / 2;
                const relY = tallaRelativeY - uniform.dimensions.height / 2;

                // Aplicar rotación de 180° alrededor del centro
                const angleRad = (uniform.rotation * Math.PI) / 180;
                const rotatedRelX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad);
                const rotatedRelY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad);

                // Convertir de vuelta a coordenadas absolutas
                tallaAbsoluteX = centerX + rotatedRelX;
                tallaAbsoluteY = centerY + rotatedRelY;
              } else {
                // Sin rotación, simplemente sumar posiciones
                tallaAbsoluteX = uniform.position.x + tallaRelativeX;
                tallaAbsoluteY = uniform.position.y + tallaRelativeY;
              }

              // Calcular ancho del texto
              const textWidth = fontBold.widthOfTextAtSize(tallaText, tallaFontSizeInPoints);

              // Usar función de transformación matricial para convertir coordenadas
              const tallaPdfPos = canvasTextToPDF(
                { x: tallaAbsoluteX, y: tallaAbsoluteY },
                uniform.rotation,
                textWidth,
                tallaFontSizeInPoints,
                { canvasHeight: heightInPoints, pixelsPerCm: canvasConfig.pixelsPerCm }
              );

              // Ajustar para centrado del texto (en canvas usa align="center", en PDF manual)
              let tallaPdfX = tallaPdfPos.x - textWidth / 2;
              let tallaPdfY = tallaPdfPos.y;

              // Para rotación 180°, el centrado funciona al revés
              if (uniform.rotation === 180) {
                tallaPdfX = tallaPdfPos.x + textWidth / 2;
              }

              // Para 90°/270°, el SVG fue pre-rotado — el texto no necesita rotación adicional
              const tallaTextRotation2 = (uniform.rotation === 90 || uniform.rotation === 270) ? 0 : uniform.rotation;
              const tallaOutlineOpts2 = { size: tallaFontSizeInPoints, font: fontBold, color: rgb(1, 1, 1), rotate: degrees(tallaTextRotation2) };
              const outlineOffsets2 = [-0.5, 0, 0.5];
              for (const dx of outlineOffsets2) {
                for (const dy of outlineOffsets2) {
                  if (dx !== 0 || dy !== 0) {
                    page.drawText(tallaText, { ...tallaOutlineOpts2, x: tallaPdfX + dx, y: tallaPdfY + dy });
                  }
                }
              }
              page.drawText(tallaText, {
                x: tallaPdfX,
                y: tallaPdfY,
                size: tallaFontSizeInPoints,
                font: fontBold,
                color: rgb(0, 0, 0),
                rotate: degrees(tallaTextRotation2),
              });
            }
          }
        } else if (element.type === 'text') {
          const textEl = element as TextElement;

          const fontSizeInPoints = (textEl.fontSize / canvasConfig.pixelsPerCm) * 28.35;
          const hexColor = textEl.fontColor || '#000000';

          // Renderizar texto como imagen PNG usando el navegador (garantiza fuente correcta)
          const textImg = await renderTextAsImage(
            pdfDoc,
            textEl.content,
            textEl.fontFamily || 'Arial',
            textEl.fontWeight || 'normal',
            fontSizeInPoints,
            hexColor,
          );

          if (textImg) {
            const xInPts = (textEl.position.x / canvasConfig.pixelsPerCm) * 28.35;
            const yInPts = (textEl.position.y / canvasConfig.pixelsPerCm) * 28.35;
            let pdfX = xInPts;
            let pdfY = heightInPoints - yInPts - textImg.heightPts + textImg.yOffsetPts;

            // Replicar el centrado de Konva: TextElement.tsx pasa width al nodo Konva solo
            // cuando dimensions.width > 450, activando textAlign='center' dentro de ese ancho.
            if (textEl.textAlign === 'center' && textEl.dimensions.width > 450) {
              const dimWidthPts = (textEl.dimensions.width / canvasConfig.pixelsPerCm) * 28.35;
              pdfX += (dimWidthPts - textImg.widthPts) / 2;
            }

            // Alinear textos rotation=180° entre Konva y PDF (ver exportDirectPDF).
            if (textEl.rotation === 180) {
              const baseX = xInPts;
              if (textEl.textAlign === 'center' && textEl.dimensions.width > 450) {
                const dimWidthPts = (textEl.dimensions.width / canvasConfig.pixelsPerCm) * 28.35;
                pdfX = baseX - (dimWidthPts - textImg.widthPts) / 2;
              } else {
                pdfX = baseX;
              }
              pdfY = heightInPoints - yInPts + textImg.heightPts - textImg.yOffsetPts;
            }

            page.drawImage(textImg.pdfImage, {
              x: pdfX,
              y: pdfY,
              width:  textImg.widthPts,
              height: textImg.heightPts,
              opacity: textEl.opacity,
              rotate: degrees(textEl.rotation),
            });
          }
        }
      }

      // Serializar este PDF individual
      const pdfBytes = await pdfDoc.save();

      // Generar nombre de archivo único para esta página
      const timestamp = Date.now();
      const fileName = `uniform-design-page${pageIndex + 1}-${cmykConfig.profile}-${timestamp}.pdf`;

      // Descargar archivo individual
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }

  } catch (error) {
    console.error('Error al exportar múltiples páginas:', error);
    throw error;
  }
};

// Tipos del payload para el servidor
interface UniformPayload {
  type: 'uniform';
  id: string;
  part: string;
  size: string;
  source: string;
  isSvg: boolean;
  rotation: number;
  zIndex: number;
  visible: boolean;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  imageDataUrl: string;
}

interface TextPngPayload {
  type: 'textPng';
  id: string;
  zIndex: number;
  visible: boolean;
  rotation: number;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  textAlign: string;
  pngDataUrl: string;
  widthPts: number;
  heightPts: number;
  yOffsetPts: number;
  content: string;
}

type ElementPayload = UniformPayload | TextPngPayload;

interface PagePayload {
  pageIndex: number;
  heightCm: number;
  elements: ElementPayload[];
}

/**
 * Serializa el diseño completo y envía al servidor para generación de PDF.
 * El servidor aplica Sharp + CMYK en paralelo — más rápido que el procesamiento en el browser.
 */
export const exportMultiPagePDFServer = async (
  options: Partial<ExportOptions> & {
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<void> => {
  const serverUrl = import.meta.env.VITE_PDF_SERVER_URL;
  if (!serverUrl) throw new Error('VITE_PDF_SERVER_URL no está configurado en .env');

  const store = useDesignerStore.getState();
  const canvasConfig = store.canvasConfig;
  const cmykConfig = getGlobalCMYKConfig();
  const totalPages = store.pages.length;

  // Cache SVG→PNG para no rasterizar la misma imagen varias veces
  const svgToPngCache = new Map<string, string>();

  const rasterizeSvg = async (svgUrl: string, widthPx: number, heightPx: number): Promise<string> => {
    const cacheKey = `${svgUrl}:${Math.round(widthPx)}:${Math.round(heightPx)}`;
    const cached = svgToPngCache.get(cacheKey);
    if (cached) return cached;
    // 1× — el servidor aplica CMYK y genera el PDF; escalar más sube el payload
    // IPC y el uso de RAM del contenedor Railway proporcionalmente (4× a 2×, 16× a 4×).
    const png = await convertSvgToPng(svgUrl, widthPx, heightPx);
    svgToPngCache.set(cacheKey, png);
    return png;
  };

  const pages: PagePayload[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (options.onProgress) options.onProgress(pageIndex + 1, totalPages);

    const elements = store.pages[pageIndex] || [];
    const heightCm = store.getPageHeight(pageIndex);
    const serializedElements: ElementPayload[] = [];

    for (const element of elements) {
      if (!element.visible) continue;

      if (element.type === 'uniform') {
        const uniform = element as UniformTemplate;

        // Resolver imagen original (nunca la comprimida)
        let originalImageUrl = resolveOriginalImage(uniform, store.uniformTemplate ?? null);

        if (!originalImageUrl) {
          // Buscar en uniformSizesConfig via URL comprimida
          const compressed = store.uniformSizesConfigCompressed;
          const original = store.uniformSizesConfig;
          for (const sizeKey of Object.keys(original)) {
            const orig = original[sizeKey];
            const comp = compressed[sizeKey];
            if (!orig || !comp) continue;
            if (uniform.imageUrl === comp.jerseyFront && orig.jerseyFront) { originalImageUrl = orig.jerseyFront; break; }
            if (uniform.imageUrl === comp.jerseyBack  && orig.jerseyBack)  { originalImageUrl = orig.jerseyBack;  break; }
            if (uniform.imageUrl === comp.shortsLeft  && orig.shortsLeft)  { originalImageUrl = orig.shortsLeft;  break; }
            if (uniform.imageUrl === comp.shortsRight && orig.shortsRight) { originalImageUrl = orig.shortsRight; break; }
          }
        }

        let imageDataUrl = originalImageUrl ?? uniform.imageUrl ?? '';

        // Rasterizar SVGs en el browser antes de enviar al servidor.
        // Sharp/librsvg en el servidor crashea con SIGBUS en ciertos SVGs.
        if (imageDataUrl.startsWith('data:image/svg+xml')) {
          imageDataUrl = await rasterizeSvg(
            imageDataUrl,
            uniform.dimensions.width,
            uniform.dimensions.height,
          );
        }

        serializedElements.push({
          type: 'uniform',
          id: uniform.id,
          part: uniform.part,
          size: uniform.size,
          source: uniform.source ?? 'manual',
          isSvg: false,
          rotation: uniform.rotation,
          zIndex: uniform.zIndex,
          visible: uniform.visible,
          position: uniform.position,
          dimensions: uniform.dimensions,
          imageDataUrl,
        });

      } else if (element.type === 'text') {
        const textEl = element as TextElement;

        const hexColor = textEl.fontColorCmyk
          ? cmykToHex(textEl.fontColorCmyk.c, textEl.fontColorCmyk.m, textEl.fontColorCmyk.y, textEl.fontColorCmyk.k)
          : (textEl.fontColor || '#000000');

        const fontSizePts = (textEl.fontSize / canvasConfig.pixelsPerCm) * 28.35;

        const rendered = await renderTextAsPng(
          textEl.content,
          textEl.fontFamily || 'Arial',
          textEl.fontWeight || 'normal',
          fontSizePts,
          hexColor,
        );

        if (rendered) {
          // Para nombres cortos (≤5 chars) centrados, buscar el jersey que los contiene
          // y calcular la x centrada dentro de él. Nombres largos (>5) ya funcionan
          // correctamente con la lógica de dimensions.width > 450 en el servidor.
          let position = textEl.position;
          if (textEl.textAlign === 'center' && textEl.content.length <= 5) {
            const containingJersey = (elements.filter(el => el.type === 'uniform') as UniformTemplate[])
              .find(j =>
                (j as UniformTemplate).part === 'jersey' &&
                textEl.position.x >= (j as UniformTemplate).position.x &&
                textEl.position.x <= (j as UniformTemplate).position.x + (j as UniformTemplate).dimensions.width &&
                textEl.position.y >= (j as UniformTemplate).position.y &&
                textEl.position.y <= (j as UniformTemplate).position.y + (j as UniformTemplate).dimensions.height
              ) as UniformTemplate | undefined;
            if (containingJersey) {
              position = {
                x: containingJersey.position.x +
                   (containingJersey.dimensions.width - textEl.dimensions.width) / 2,
                y: textEl.position.y,
              };
            }
          }

          serializedElements.push({
            type: 'textPng',
            id: textEl.id,
            zIndex: textEl.zIndex,
            visible: textEl.visible,
            rotation: textEl.rotation,
            position,
            dimensions: textEl.dimensions,
            textAlign: textEl.textAlign,
            pngDataUrl: rendered.pngDataUrl,
            widthPts: rendered.widthPts,
            heightPts: rendered.heightPts,
            yOffsetPts: rendered.yOffsetPts,
            content: textEl.content,
          });
        }
      }
    }

    pages.push({ pageIndex, heightCm, elements: serializedElements });
  }

  // Enviar al servidor
  const response = await fetch(`${serverUrl}/api/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages, canvasConfig, cmykConfig }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error ?? `Error del servidor: ${response.status}`);
  }

  const { pages: resultPages } = await response.json();

  // Descargar cada página como archivo separado
  for (const resultPage of resultPages) {
    const bytes = Uint8Array.from(atob(resultPage.pdfBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = resultPage.fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Exporta según el formato especificado
 */
export const exportCanvas = async (
  element: HTMLElement,
  options: ExportOptions
): Promise<void> => {
  if (options.format === 'pdf') {
    await exportAsPDF(element, options);
  } else {
    await exportAsPNG(element, options);
  }
};
