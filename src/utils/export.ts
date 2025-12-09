import { toPng } from 'html-to-image';
import { PDFDocument, PDFImage, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { ExportOptions, UniformTemplate, TextElement } from '../types';
import { useDesignerStore } from '../store/desingerStore';
import { convertImageRGBtoCMYK, type CMYKConversionOptions } from './colorConversion';
import { addPrintMarks, expandPageForMarks, generatePrintFileName } from './printMarks';
import { runPreflight, generatePreflightReport } from './preflight';
import { getGlobalCMYKConfig } from './cmykConfig';

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
 * Aplica rotación 2D alrededor de un punto central
 */
function rotatePoint(point: Point, center: Point, angleRad: number): Point {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Trasladar al origen
  const translatedX = point.x - center.x;
  const translatedY = point.y - center.y;

  // Aplicar rotación
  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  // Trasladar de vuelta
  return {
    x: rotatedX + center.x,
    y: rotatedY + center.y,
  };
}

/**
 * Convierte coordenadas de canvas (Konva) a coordenadas PDF para textos
 * Maneja correctamente las rotaciones replicando la transformación de Konva
 *
 * @param canvasPos - Posición absoluta del texto en canvas (píxeles)
 * @param rotation - Rotación en grados (0, 90, 180, 270)
 * @param textWidth - Ancho del texto en puntos PDF
 * @param fontSize - Tamaño de fuente en puntos PDF
 * @param config - Configuración del canvas (altura, pixelsPerCm)
 * @returns Posición del texto en coordenadas PDF
 */
function canvasTextToPDF(
  canvasPos: Point,
  rotation: number,
  textWidth: number,
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
 * Exporta el canvas como imagen PNG
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

    // Reemplazar imágenes comprimidas por originales
    console.log('📸 Preparando imágenes originales para exportación PNG...');
    restoreImages = await swapToOriginalImages(element);

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

    // Embeber fuente para texto
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
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

        // Si no se encontró en el mapeo, usar originalImageUrl o imageUrl como fallback
        if (!originalImageUrl) {
          originalImageUrl = uniform.originalImageUrl || uniform.imageUrl;
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

        console.log(`  📝 Procesando texto: "${textEl.content}"`);

        // Convertir tamaño de fuente de píxeles del canvas a puntos del PDF
        // fontSize en canvas está en píxeles, necesitamos escalarlo a puntos PDF
        // usando la misma proporción que para las dimensiones (28.35 / pixelsPerCm)
        const fontSizeInPoints = (textEl.fontSize / canvasConfig.pixelsPerCm) * 28.35;

        // Calcular ancho del texto
        const textFont = textEl.fontWeight === 'bold' ? fontBold : font;
        const textWidth = textFont.widthOfTextAtSize(textEl.content, fontSizeInPoints);

        // Usar función de transformación matricial para convertir coordenadas
        const pdfPos = canvasTextToPDF(
          { x: textEl.position.x, y: textEl.position.y },
          textEl.rotation,
          textWidth,
          fontSizeInPoints,
          { canvasHeight: heightInPoints, pixelsPerCm: canvasConfig.pixelsPerCm }
        );

        const pdfX = pdfPos.x;
        const pdfY = pdfPos.y;

        // Convertir color de hex a RGB
        const hexColor = textEl.fontColor || '#000000';
        const r = parseInt(hexColor.slice(1, 3), 16) / 255;
        const g = parseInt(hexColor.slice(3, 5), 16) / 255;
        const b = parseInt(hexColor.slice(5, 7), 16) / 255;

        // Renderizar texto
        page.drawText(textEl.content, {
          x: pdfX,
          y: pdfY,
          size: fontSizeInPoints,
          font: textEl.fontWeight === 'bold' ? fontBold : font,
          color: rgb(r, g, b),
          opacity: textEl.opacity,
          rotate: degrees(textEl.rotation),
        });

        console.log(`  ✓ Texto renderizado`);
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

    console.log(`📄 Exportando ${totalPages} páginas con composición directa...`);

    // Procesar cada página
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      console.log(`\n📑 Procesando página ${pageIndex + 1}/${totalPages}...`);

      // Actualizar progreso
      if (options.onProgress) {
        options.onProgress(pageIndex + 1, totalPages);
      }

      // Obtener elementos de esta página directamente
      const elements = store.pages[pageIndex] || [];
      const uniformSizesConfig = store.uniformSizesConfig;

      // Obtener altura de la página
      const pageHeightCm = store.getPageHeight(pageIndex);

      // Calcular dimensiones en puntos
      const canvasWidthCm = options.canvasWidth || canvasConfig.width;
      const widthInPoints = canvasWidthCm * 28.35;
      const heightInPoints = pageHeightCm * 28.35;

      // Crear documento PDF
      const pdfDoc = await PDFDocument.create();

      // Configurar metadata
      pdfDoc.setTitle(`Uniform Design - Page ${pageIndex + 1}`);
      pdfDoc.setAuthor('Uniform Perfect Designer');
      pdfDoc.setSubject(`Diseño de uniformes - Página ${pageIndex + 1} - Perfil: ${cmykConfig.profile}`);
      pdfDoc.setKeywords(['CMYK', 'Print', 'Uniform', 'Design', cmykConfig.profile, `Page ${pageIndex + 1}`]);
      pdfDoc.setProducer('pdf-lib + Professional CMYK Direct Composer');
      pdfDoc.setCreator('Uniform Perfect Designer v2.1 Direct Multi-Page');

      // Crear página
      const page = pdfDoc.addPage([widthInPoints, heightInPoints]);

      // Embeber fuentes
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
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
            originalImageUrl = uniform.originalImageUrl || uniform.imageUrl;
          }

          if (originalImageUrl) {
            // Convertir a CMYK
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

            maxTAC = Math.max(maxTAC, tacStats.max);
            avgTAC += tacStats.average;
            tacCount++;

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

          // Convertir tamaño de fuente de píxeles del canvas a puntos del PDF
          // fontSize en canvas está en píxeles, necesitamos escalarlo a puntos PDF
          // usando la misma proporción que para las dimensiones (28.35 / pixelsPerCm)
          const fontSizeInPoints = (textEl.fontSize / canvasConfig.pixelsPerCm) * 28.35;

          // Calcular ancho del texto
          const textFont = textEl.fontWeight === 'bold' ? fontBold : font;
          const textWidth = textFont.widthOfTextAtSize(textEl.content, fontSizeInPoints);

          // Usar función de transformación matricial para convertir coordenadas
          const pdfPos = canvasTextToPDF(
            { x: textEl.position.x, y: textEl.position.y },
            textEl.rotation,
            textWidth,
            fontSizeInPoints,
            { canvasHeight: heightInPoints, pixelsPerCm: canvasConfig.pixelsPerCm }
          );

          const pdfX = pdfPos.x;
          const pdfY = pdfPos.y;

          const hexColor = textEl.fontColor || '#000000';
          const r = parseInt(hexColor.slice(1, 3), 16) / 255;
          const g = parseInt(hexColor.slice(3, 5), 16) / 255;
          const b = parseInt(hexColor.slice(5, 7), 16) / 255;

          page.drawText(textEl.content, {
            x: pdfX,
            y: pdfY,
            size: fontSizeInPoints,
            font: textEl.fontWeight === 'bold' ? fontBold : font,
            color: rgb(r, g, b),
            opacity: textEl.opacity,
            rotate: degrees(textEl.rotation),
          });
        }
      }

      // Calcular TAC promedio
      avgTAC = tacCount > 0 ? avgTAC / tacCount : 0;
      const tacStats = { min: 0, max: maxTAC, average: avgTAC };

      // Serializar PDF
      const pdfBytes = await pdfDoc.save();

      // Generar nombre de archivo
      const timestamp = Date.now();
      const fileName = totalPages > 1
        ? `uniform-design-direct-page${pageIndex + 1}-${cmykConfig.profile}-TAC${Math.round(tacStats.max)}-${timestamp}.pdf`
        : `uniform-design-direct-${cmykConfig.profile}-TAC${Math.round(tacStats.max)}-${timestamp}.pdf`;

      // Descargar
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      console.log(`✓ Página ${pageIndex + 1} exportada: ${fileName}`);
      console.log(`  TAC máx: ${tacStats.max.toFixed(1)}%`);

      // Pequeña pausa entre descargas
      if (pageIndex < totalPages - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ ${totalPages} páginas exportadas con CALIDAD COMPLETA`);
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
