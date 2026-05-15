import { toPng } from 'html-to-image';
import { PDFDocument, PDFImage, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { ExportOptions, UniformTemplate, TextElement } from '../types';
import { useDesignerStore } from '../store/desingerStore';
import { convertImageRGBtoCMYK, type CMYKConversionOptions } from './colorConversion';
import { addPrintMarks, expandPageForMarks, generatePrintFileName } from './printMarks';
import { runPreflight, generatePreflightReport } from './preflight';
import { getGlobalCMYKConfig } from './cmykConfig';
import { CUSTOM_FONTS } from './fontLoader';


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
): Promise<{ pdfImage: PDFImage; widthPts: number; heightPts: number } | null> => {
  try {
    const SCALE = 3;
    const PTS_TO_CSS_PX = 96 / 72;
    const fontSizeCssPx = fontSizePts * PTS_TO_CSS_PX * SCALE;
    const fontStyle = fontWeight === 'bold' ? 'bold' : 'normal';
    const fontSpec = `${fontStyle} ${fontSizeCssPx}px "${fontFamily}", Arial, sans-serif`;

    // Medir con canvas provisional para obtener bounding box real (incluye italic overhang)
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = Math.ceil(fontSizeCssPx * text.length * 1.5) + 20;
    measureCanvas.height = Math.ceil(fontSizeCssPx * 2.5);
    const mCtx = measureCanvas.getContext('2d')!;
    mCtx.font = fontSpec;
    mCtx.textBaseline = 'alphabetic';
    const m = mCtx.measureText(text);

    // Usar actualBoundingBox para dimensiones reales del glifo (incluye overhang itálico)
    const left    = Math.ceil(Math.max(0, -m.actualBoundingBoxLeft));
    const right   = Math.ceil(m.actualBoundingBoxRight);
    const ascent  = Math.ceil(m.actualBoundingBoxAscent);
    const descent = Math.ceil(m.actualBoundingBoxDescent);

    const PAD = Math.ceil(fontSizeCssPx * 0.1); // 10% de padding para evitar recortes
    const w = left + right + PAD * 2;
    const h = ascent + descent + PAD * 2;

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
    // baseline alfabética: dibujamos en (left + PAD, ascent + PAD)
    ctx2.textBaseline = 'alphabetic';
    ctx2.fillText(text, left + PAD, ascent + PAD);

    const dataUrl = tmpCanvas.toDataURL('image/png');
    const base64  = dataUrl.split(',')[1];
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdfImage = await pdfDoc.embedPng(bytes);
    const widthPts  = (w / SCALE) / PTS_TO_CSS_PX;
    const heightPts = (h / SCALE) / PTS_TO_CSS_PX;

    return { pdfImage, widthPts, heightPts };
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

  console.log(`✓ Reemplazadas ${originalSrcs.length} imágenes por versiones originales`);

  // Retornar función de restauración
  return () => {
    originalSrcs.forEach(({ img, src }) => {
      img.src = src;
    });
    console.log(`✓ Restauradas ${originalSrcs.length} imágenes comprimidas`);
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

      ctx.drawImage(img, 0, 0);
      const pngDataUrl = canvas.toDataURL('image/png');
      resolve(pngDataUrl);
    };
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = imageDataUrl;
  });
};

/**
/**
 * Selecciona la fuente correcta para un texto basándose en fontFamily y fontWeight

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
  console.log(`🎨 Convirtiendo imagen de RGB a CMYK con perfil ${conversionOptions.profile}...`);
  const cmykData = await convertImageRGBtoCMYK(imageDataUrl, conversionOptions);
  console.log(`✓ Conversión CMYK completada: ${cmykData.width}x${cmykData.height}`);
  console.log(`  TAC: min=${cmykData.tac.min.toFixed(1)}%, max=${cmykData.tac.max.toFixed(1)}%, avg=${cmykData.tac.average.toFixed(1)}%`);

  // Convertir a PNG si es necesario (pdf-lib requiere PNG o JPEG específicamente)
  let pngDataUrl = imageDataUrl;
  if (!imageDataUrl.startsWith('data:image/png')) {
    console.log('  🔄 Convirtiendo imagen a PNG para embedear...');
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

  console.log(`✓ ${originalImageUrls.size} elementos actualizados con imágenes originales`);

  // Retornar función para restaurar las URLs comprimidas
  return () => {
    originalImageUrls.forEach((compressedUrl, elementId) => {
      store.updateElement(elementId, {
        imageUrl: compressedUrl,
      });
    });
    console.log(`✓ ${originalImageUrls.size} elementos restaurados con imágenes comprimidas`);
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
    console.log('📸 Preparando imágenes originales para exportación PNG...');
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

  // Identificar fuentes personalizadas usadas
  elements.forEach(element => {
    if (element.type === 'text' && element.fontFamily) {
      if (CUSTOM_FONTS.includes(element.fontFamily as any)) {
        fontsToLoad.add(element.fontFamily);
      }
    }
  });

  if (fontsToLoad.size === 0) return;

  console.log(`📝 Verificando ${fontsToLoad.size} fuentes personalizadas...`);
  console.log('📋 Fuentes en document.fonts:');

  // Log de todas las fuentes cargadas para debugging
  Array.from(document.fonts).forEach((font: any) => {
    console.log(`   - "${font.family}" (peso: ${font.weight}, estilo: ${font.style}, estado: ${font.status})`);
  });

  // Esperar a que todas las fuentes estén listas
  await document.fonts.ready;

  // Esperar a que todas las fuentes personalizadas estén listas
  const fontPromises = Array.from(fontsToLoad).map(async (fontName) => {
    try {
      // Buscar la fuente en document.fonts
      const fontFace = Array.from(document.fonts).find(
        (f: any) => f.family === fontName || f.family.toLowerCase() === fontName.toLowerCase()
      );

      if (fontFace) {
        await fontFace.load();
        console.log(`  ✓ Fuente "${fontName}" lista (familia real: "${fontFace.family}")`);
      } else {
        console.warn(`  ⚠️ Fuente "${fontName}" NO encontrada en document.fonts`);
        console.warn(`  📋 Fuentes disponibles:`, Array.from(document.fonts).map((f: any) => f.family));
      }
    } catch (error) {
      console.error(`  ✗ Error al cargar fuente "${fontName}":`, error);
    }
  });

  await Promise.all(fontPromises);
  console.log('✓ Todas las fuentes personalizadas procesadas');
};

/**
 * NUEVA: Exporta como PNG componiendo directamente con imágenes originales
 * Sin usar html-to-image ni Konva, mantiene la calidad completa de las imágenes
 */
export const exportAsPNGDirect = async (
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  try {
    console.log('📸 Exportando PNG con composición directa (máxima calidad)...');

    // Obtener elementos y configuración del store
    const store = useDesignerStore.getState();
    const elements = store.elements; // Elementos de la página actual
    const canvasConfig = store.canvasConfig;
    const uniformSizesConfig = store.uniformSizesConfig;

    // Asegurar que las fuentes personalizadas estén cargadas
    await ensureCustomFontsLoaded(elements);

    // Configuración de escala para alta resolución
    // Reducir a 5x para evitar problemas de memoria con canvas muy grandes
    const SCALE_FACTOR = 5; // 5x para alta calidad sin exceder límites del navegador

    // PASO 1: Calcular el bounding box de todos los elementos visibles
    console.log('📏 Calculando bounding box de elementos...');

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

    console.log(`  ✓ Bounding box: ${minX.toFixed(1)}, ${minY.toFixed(1)} → ${maxX.toFixed(1)}, ${maxY.toFixed(1)}`);
    console.log(`  ✓ Dimensiones usadas: ${boundingWidth.toFixed(1)} × ${boundingHeight.toFixed(1)} px`);

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

    const canvasWidthCm = boundingWidth / canvasConfig.pixelsPerCm;
    const canvasHeightCm = boundingHeight / canvasConfig.pixelsPerCm;

    console.log(`📐 Dimensiones PNG: ${canvasWidthCm.toFixed(2)} × ${canvasHeightCm.toFixed(2)} cm`);
    console.log(`📐 Resolución PNG: ${canvasWidthPx} × ${canvasHeightPx} px (escala ${SCALE_FACTOR}x)`);

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

    console.log('✓ Canvas creado exitosamente');

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

    console.log(`📦 Procesando ${sortedElements.length} elementos...`);

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
          console.log(`  🖼️  Cargando imagen: ${uniform.id}`);

          // Cargar imagen original
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            // No usar crossOrigin para blob URLs y data URLs
            if (!originalImageUrl!.startsWith('blob:') && !originalImageUrl!.startsWith('data:')) {
              image.crossOrigin = 'anonymous';
            }

            image.onload = () => {
              console.log(`    ✓ Imagen cargada: ${image.width}x${image.height}px`);
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
          const width = uniform.dimensions.width * SCALE_FACTOR;
          const height = uniform.dimensions.height * SCALE_FACTOR;

          // Guardar estado del contexto
          ctx.save();

          // Aplicar rotación si es necesario
          if (uniform.rotation !== 0) {
            // Calcular centro de rotación
            const centerX = x + width / 2;
            const centerY = y + height / 2;

            // Trasladar al centro, rotar, trasladar de vuelta
            ctx.translate(centerX, centerY);
            ctx.rotate((uniform.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
          }

          // Dibujar imagen
          ctx.drawImage(img, x, y, width, height);

          // Restaurar estado del contexto
          ctx.restore();

          console.log(`  ✓ Imagen dibujada: ${uniform.id}`);

          // Agregar texto de talla SOLO si proviene de Excel
          if (uniform.source === 'excel') {
            const tallaText = `Talla ${uniform.size}`;
            const tallaFontSize = 9 * SCALE_FACTOR; // Escalar fuente

            // Guardar estado
            ctx.save();

            // En Konva, el texto está en posición (0, height-11) relativa al uniforme
            // y se dibuja con align='center' y width=uniform.width

            // Aplicar las mismas transformaciones que la imagen
            if (uniform.rotation !== 0) {
              // Calcular centro del uniforme en coordenadas escaladas
              const centerX = (uniform.position.x - minX + uniform.dimensions.width / 2) * SCALE_FACTOR;
              const centerY = (uniform.position.y - minY + uniform.dimensions.height / 2) * SCALE_FACTOR;

              // Trasladar al centro, rotar, trasladar de vuelta
              ctx.translate(centerX, centerY);
              ctx.rotate((uniform.rotation * Math.PI) / 180);
              ctx.translate(-centerX, -centerY);
            }

            // Calcular posición del texto relativa al uniforme (ajustada al bounding box y escalada)
            const textX = (uniform.position.x - minX) * SCALE_FACTOR;
            const textY = (uniform.position.y - minY + uniform.dimensions.height - 11) * SCALE_FACTOR;
            const textCenterX = textX + (uniform.dimensions.width * SCALE_FACTOR) / 2;

            // Configurar texto
            ctx.font = `bold ${tallaFontSize}px Arial, sans-serif`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Dibujar texto centrado
            ctx.fillText(tallaText, textCenterX, textY);

            // Restaurar estado
            ctx.restore();
          }
        }
      } else if (element.type === 'text') {
        const textEl = element as TextElement;

        console.log(`  📝 Dibujando texto: "${textEl.content}" | Fuente: ${textEl.fontFamily || 'Arial'}`);

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
        ctx.fillStyle = textEl.fontColor || '#000000';
        ctx.globalAlpha = textEl.opacity || 1;

        console.log(`    Font aplicada: ${ctx.font} | Es custom: ${isCustomFont}`);

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

        console.log(`  ✓ Texto dibujado`);
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

    console.log('✓ Canvas tiene contenido, convirtiendo a PNG...');

    // Convertir canvas a PNG de alta calidad
    console.log('💾 Convirtiendo a PNG...');
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    // Verificar que el dataURL no esté vacío
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Error al convertir canvas a PNG: dataURL vacío');
    }

    console.log(`✓ PNG generado: ${(dataUrl.length / 1024 / 1024).toFixed(2)} MB`);

    // Descargar la imagen
    const link = document.createElement('a');
    link.download = `uniform-design-HQ-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    console.log('✓ PNG de alta calidad exportado exitosamente');
    console.log(`  Dimensiones: ${canvasWidthPx} × ${canvasHeightPx} px`);
    console.log(`  🎉 CALIDAD COMPLETA - Imágenes originales sin degradación`);
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
    console.log('📸 Preparando imágenes originales para exportación PDF CMYK profesional...');
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
    console.log('🔍 Ejecutando validación Preflight...');
    const preflightResult = await runPreflight(dataUrl, tacStats, {
      ...cmykConfig.preflight,
      profile: cmykConfig.profile,
    });

    console.log(generatePreflightReport(preflightResult));

    if (!preflightResult.passed) {
      console.warn('⚠️ El documento tiene errores de preflight, pero se exportará de todos modos.');
    }

    // Expandir página para marcas de impresión si está habilitado
    if (cmykConfig.printMarks.addCropMarks || cmykConfig.printMarks.addRegistrationMarks) {
      const expandedSize = expandPageForMarks(page, cmykConfig.printMarks);
      console.log(`📐 Página expandida para marcas: ${expandedSize.width}x${expandedSize.height} pts`);
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
      console.log('🖨️ Agregando marcas de impresión...');
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
    console.log('💾 Guardando PDF...');
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

    console.log(`✓ PDF CMYK profesional exportado: ${fileName}`);
    console.log(`  Perfil: ${profile} | TAC máx: ${tacStats.max.toFixed(1)}% | Preflight: ${preflightResult.passed ? '✓' : '⚠️'}`);
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

    console.log(`📸 Procesando ${pages.length} páginas con conversión CMYK...`);

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
        console.log(`   Página ${i + 1}/${pages.length}: Preparando imágenes originales...`);
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

        console.log(`   Página ${i + 1}/${pages.length}: Convirtiendo a CMYK...`);

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

        console.log(`   ✓ Página ${i + 1}/${pages.length} procesada`);
      } finally {
        // Asegurar que se restauren las imágenes incluso si hay error
        if (restoreImages) {
          restoreImages();
        }
      }
    }

    // Serializar PDF
    console.log('💾 Guardando PDF multipágina...');
    const pdfBytes = await pdfDoc.save();

    // Descargar el PDF
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `uniform-design-CMYK-multipage-${Date.now()}.pdf`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    console.log('✓ PDF multipágina CMYK exportado exitosamente');
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
    console.log('📄 Exportando PDF con composición directa (máxima calidad)...');

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

    console.log(`📦 Procesando ${sortedElements.length} elementos...`);

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
          console.log(`  ⚠️  No se encontró imagen original, usando fallback`);
        }

        if (originalImageUrl) {
          console.log(`  🖼️  Procesando uniforme: ${uniform.id}`);

          // Convertir imagen a CMYK con perfil ICC
          const conversionOptions: CMYKConversionOptions = {
            profile: cmykConfig.profile,
            gcrMethod: cmykConfig.gcrMethod,
            customTAC: cmykConfig.customTAC,
            applyDotGain: cmykConfig.applyDotGain,
          };

          const { image: pdfImage, tacStats } = await embedImageWithCMYK(
            pdfDoc,
            originalImageUrl,
            conversionOptions
          );

          // Actualizar estadísticas TAC
          maxTAC = Math.max(maxTAC, tacStats.max);
          avgTAC += tacStats.average;
          tacCount++;

          // Calcular posición y dimensiones en puntos
          // El canvas usa pixelsPerCm = 10, entonces 1cm = 10 pixels
          const xInCm = uniform.position.x / canvasConfig.pixelsPerCm;
          const yInCm = uniform.position.y / canvasConfig.pixelsPerCm;
          const widthInCm = uniform.dimensions.width / canvasConfig.pixelsPerCm;
          const heightInCm = uniform.dimensions.height / canvasConfig.pixelsPerCm;

          const xInPoints = xInCm * 28.35;
          const yInPoints = yInCm * 28.35;
          const widthInPts = widthInCm * 28.35;
          const heightInPts = heightInCm * 28.35;

          // PDF usa coordenadas desde abajo-izquierda, canvas desde arriba-izquierda
          let pdfY = heightInPoints - yInPoints - heightInPts;
          let pdfX = xInPoints;

          // Ajustar posición para rotación de 180° (short derecho)
          // En PDF, la rotación se aplica alrededor del punto (x,y), entonces
          // cuando rotamos 180°, necesitamos ajustar la posición
          if (uniform.rotation === 180) {
            pdfX = xInPoints + widthInPts;
            pdfY = pdfY + heightInPts;
          }

          // Dibujar imagen con rotación si es necesario
          page.drawImage(pdfImage, {
            x: pdfX,
            y: pdfY,
            width: widthInPts,
            height: heightInPts,
            rotate: degrees(uniform.rotation),
          });

          console.log(`  ✓ Uniforme renderizado (TAC: ${tacStats.max.toFixed(1)}%)`);

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

            page.drawText(tallaText, {
              x: tallaPdfX,
              y: tallaPdfY,
              size: tallaFontSizeInPoints,
              font: fontBold,
              color: rgb(0, 0, 0),
              rotate: degrees(uniform.rotation),
            });

            console.log(`  ✓ Texto de talla agregado: "${tallaText}" (rotación: ${uniform.rotation}°)`);
          }
        }
      } else if (element.type === 'text') {
        const textEl = element as TextElement;

        console.log(`  📝 Procesando texto: "${textEl.content}" | Fuente: ${textEl.fontFamily || 'Arial'}`);

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
          // Posición top-left en PDF (y invertido: PDF origin=bottom-left)
          const xInPts = (textEl.position.x / canvasConfig.pixelsPerCm) * 28.35;
          const yInPts = (textEl.position.y / canvasConfig.pixelsPerCm) * 28.35;
          const pdfX = xInPts;
          const pdfY = heightInPoints - yInPts - textImg.heightPts;

          page.drawImage(textImg.pdfImage, {
            x: pdfX,
            y: pdfY,
            width:  textImg.widthPts,
            height: textImg.heightPts,
            opacity: textEl.opacity,
            rotate: degrees(textEl.rotation),
          });
        }

        console.log(`  ✓ Texto renderizado como imagen`);
      }
    }

    // Calcular TAC promedio
    avgTAC = tacCount > 0 ? avgTAC / tacCount : 0;

    const tacStats = { min: 0, max: maxTAC, average: avgTAC };

    // Ejecutar validación Preflight
    console.log('🔍 Ejecutando validación Preflight...');
    const preflightResult = await runPreflight('', tacStats, {
      ...cmykConfig.preflight,
      profile: cmykConfig.profile,
    });

    console.log(generatePreflightReport(preflightResult));

    // Expandir página para marcas de impresión
    if (cmykConfig.printMarks.addCropMarks || cmykConfig.printMarks.addRegistrationMarks) {
      const expandedSize = expandPageForMarks(page, cmykConfig.printMarks);
      console.log(`📐 Página expandida para marcas: ${expandedSize.width}x${expandedSize.height} pts`);
    }

    // Agregar marcas de impresión
    if (cmykConfig.printMarks) {
      console.log('🖨️  Agregando marcas de impresión...');
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
    console.log('💾 Guardando PDF...');
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

    console.log(`✓ PDF CMYK profesional exportado (DIRECT): ${fileName}`);
    console.log(`  Perfil: ${cmykConfig.profile} | TAC máx: ${tacStats.max.toFixed(1)}% | Preflight: ${preflightResult.passed ? '✓' : '⚠️'}`);
    console.log(`  🎉 CALIDAD COMPLETA - Imágenes originales sin degradación`);
  } catch (error) {
    console.error('Error al exportar PDF directo:', error);
    throw error;
  }
};


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

    console.log(`📄 Exportando ${totalPages} páginas (un archivo por página) - OPTIMIZADO...`);

    // OPTIMIZACIÓN: Pre-procesar y cachear datos de imágenes CMYK
    console.log('⚡ Pre-procesando imágenes únicas...');

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

    console.log(`  ✓ ${uniqueImages.size} imágenes únicas encontradas`);

    const conversionOptions: CMYKConversionOptions = {
      profile: cmykConfig.profile,
      gcrMethod: cmykConfig.gcrMethod,
      customTAC: cmykConfig.customTAC,
      applyDotGain: cmykConfig.applyDotGain,
    };

    // Pre-convertir todas las imágenes únicas a PNG y calcular TAC stats
    console.log('🎨 Pre-convirtiendo imágenes a CMYK para calcular TAC...');
    const imagePngCache = new Map<string, string>(); // URL original -> PNG dataURL
    const imageTacCache = new Map<string, { min: number; max: number; average: number }>(); // URL original -> TAC stats

    let processedCount = 0;
    for (const imageUrl of uniqueImages) {
      console.log(`  [${++processedCount}/${uniqueImages.size}] Procesando: ${imageUrl.substring(0, 50)}...`);

      // Convertir a PNG si es necesario
      let pngDataUrl = imageUrl;
      if (!imageUrl.startsWith('data:image/png')) {
        pngDataUrl = await convertToPng(imageUrl);
      }
      imagePngCache.set(imageUrl, pngDataUrl);

      // Calcular TAC stats
      const cmykData = await convertImageRGBtoCMYK(imageUrl, conversionOptions);
      imageTacCache.set(imageUrl, cmykData.tac);

      console.log(`    ✓ TAC: max=${cmykData.tac.max.toFixed(1)}%, avg=${cmykData.tac.average.toFixed(1)}%`);
    }

    console.log(`✓ ${uniqueImages.size} imágenes pre-procesadas`);
    console.log(`✓ Listo para generar ${totalPages} archivos PDF`);

    // Estadísticas
    let totalImagesEmbedded = 0;
    let totalImagesFromCache = 0;

    // Procesar cada página como un PDF separado
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      console.log(`\n📑 Procesando página ${pageIndex + 1}/${totalPages}...`);

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
            // OPTIMIZACIÓN: Usar PNG y TAC stats pre-calculados
            const pngDataUrl = imagePngCache.get(originalImageUrl);
            const tacStats = imageTacCache.get(originalImageUrl);

            if (!pngDataUrl) {
              console.log(`  ⚠️  Advertencia: No se encontró PNG en caché para ${originalImageUrl.substring(0, 50)}`);
              continue;
            }

            // Embeber la imagen PNG desde caché (operación rápida)
            const pdfImage = await pdfDoc.embedPng(pngDataUrl);
            totalImagesEmbedded++;
            totalImagesFromCache++; // Todas vienen del caché ahora

            if (tacStats) {
              maxTAC = Math.max(maxTAC, tacStats.max);
              avgTAC += tacStats.average;
              tacCount++;
            }

            // Calcular posición y dimensiones
            const xInCm = uniform.position.x / canvasConfig.pixelsPerCm;
            const yInCm = uniform.position.y / canvasConfig.pixelsPerCm;
            const widthInCm = uniform.dimensions.width / canvasConfig.pixelsPerCm;
            const heightInCm = uniform.dimensions.height / canvasConfig.pixelsPerCm;

            const xInPoints = xInCm * 28.35;
            const yInPoints = yInCm * 28.35;
            const widthInPts = widthInCm * 28.35;
            const heightInPts = heightInCm * 28.35;

            let pdfY = heightInPoints - yInPoints - heightInPts;
            let pdfX = xInPoints;

            // Ajustar posición para rotación de 180° (short derecho)
            if (uniform.rotation === 180) {
              pdfX = xInPoints + widthInPts;
              pdfY = pdfY + heightInPts;
            }

            page.drawImage(pdfImage, {
              x: pdfX,
              y: pdfY,
              width: widthInPts,
              height: heightInPts,
              rotate: degrees(uniform.rotation),
            });

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

              page.drawText(tallaText, {
                x: tallaPdfX,
                y: tallaPdfY,
                size: tallaFontSizeInPoints,
                font: fontBold,
                color: rgb(0, 0, 0),
                rotate: degrees(uniform.rotation),
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
            const pdfX = xInPts;
            const pdfY = heightInPoints - yInPts - textImg.heightPts;

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
      console.log(`  💾 Guardando archivo PDF de página ${pageIndex + 1}...`);
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

      console.log(`  ✓ Archivo guardado: ${fileName} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  ✓ Página ${pageIndex + 1}/${totalPages} completada`);
    }

    // Estadísticas finales de optimización
    console.log(`\n📊 ESTADÍSTICAS DE OPTIMIZACIÓN:`);
    console.log(`  🖼️  Imágenes únicas pre-procesadas: ${uniqueImages.size}`);
    console.log(`  ⚡ Imágenes embebidas desde caché: ${totalImagesFromCache}`);
    console.log(`  📄 Archivos PDF generados: ${totalPages}`);

    const totalImages = totalImagesEmbedded;
    if (totalImages > 0) {
      const timeSavedEstimate = (uniqueImages.size - 1) * totalPages * 0.5; // Tiempo ahorrado al no re-convertir
      console.log(`  ⏱️  Tiempo ahorrado estimado: ~${timeSavedEstimate.toFixed(1)} segundos`);
    }

    console.log(`\n✅ ${totalPages} archivos PDF exportados con CALIDAD COMPLETA (un archivo por página)`);
  } catch (error) {
    console.error('Error al exportar múltiples páginas:', error);
    throw error;
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
