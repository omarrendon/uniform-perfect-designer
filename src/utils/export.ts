import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import type { ExportOptions } from '../types';
import { useDesignerStore } from '../store/desingerStore';

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
 * Exporta el canvas como imagen PNG
 */
export const exportAsPNG = async (
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  let restoreImages: (() => void) | null = null;

  try {
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
  }
};

/**
 * Exporta el canvas como PDF
 * @param element - Elemento HTML del canvas
 * @param options - Opciones de exportación (incluye canvasWidth y canvasHeight en cm)
 */
export const exportAsPDF = async (
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  let restoreImages: (() => void) | null = null;

  try {
    // Reemplazar imágenes comprimidas por originales
    console.log('📸 Preparando imágenes originales para exportación PDF...');
    restoreImages = await swapToOriginalImages(element);

    // Exportar con imágenes originales
    const dataUrl = await toPng(element, {
      backgroundColor: options.backgroundColor || '#ffffff',
      quality: options.quality || 1.0,
      pixelRatio: 24, // 600 DPI para impresión ultra profesional (10 × 2.54 × 24 = 609.6 DPI)
    });

    const img = new Image();
    img.src = dataUrl;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // Usar las dimensiones del canvas en centímetros si están disponibles
    // Si no, usar las dimensiones de la imagen
    const canvasWidthCm = options.canvasWidth || img.width / 10;
    const canvasHeightCm = options.canvasHeight || img.height / 10;

    // Crear PDF con dimensiones exactas en centímetros
    const pdf = new jsPDF({
      orientation: canvasWidthCm > canvasHeightCm ? 'landscape' : 'portrait',
      unit: 'cm',
      format: [canvasWidthCm, canvasHeightCm],
    });

    // Agregar la imagen ocupando todo el espacio del PDF (PNG sin compresión con pérdida)
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvasWidthCm, canvasHeightCm);
    pdf.save(`uniform-design-${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    throw error;
  } finally {
    // Restaurar imágenes comprimidas
    if (restoreImages) {
      restoreImages();
    }
  }
};

/**
 * Exporta múltiples páginas como un solo PDF con múltiples hojas
 * @param pages - Array de elementos HTML de cada página del canvas
 * @param options - Opciones de exportación
 */
export const exportMultiPagePDF = async (
  pages: HTMLElement[],
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  try {
    if (pages.length === 0) {
      throw new Error('No hay páginas para exportar');
    }

    // Usar las dimensiones del canvas en centímetros
    const canvasWidthCm = options.canvasWidth || 100;
    const canvasHeightCm = options.canvasHeight || 100;

    // Crear PDF con dimensiones exactas en centímetros
    const pdf = new jsPDF({
      orientation: canvasWidthCm > canvasHeightCm ? 'landscape' : 'portrait',
      unit: 'cm',
      format: [canvasWidthCm, canvasHeightCm],
    });

    console.log(`📸 Procesando ${pages.length} páginas con imágenes originales...`);

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
          pixelRatio: 24, // 600 DPI para impresión ultra profesional (10 × 2.54 × 24 = 609.6 DPI)
        });

        // Restaurar imágenes comprimidas inmediatamente después de capturar
        if (restoreImages) {
          restoreImages();
          restoreImages = null;
        }

        // Si no es la primera página, agregar una nueva página al PDF
        if (i > 0) {
          pdf.addPage([canvasWidthCm, canvasHeightCm]);
        }

        // Agregar la imagen a la página actual (PNG sin compresión con pérdida)
        pdf.addImage(dataUrl, 'PNG', 0, 0, canvasWidthCm, canvasHeightCm);
        console.log(`   ✓ Página ${i + 1}/${pages.length} procesada`);
      } finally {
        // Asegurar que se restauren las imágenes incluso si hay error
        if (restoreImages) {
          restoreImages();
        }
      }
    }

    // Guardar el PDF
    pdf.save(`uniform-design-${Date.now()}.pdf`);
    console.log('✓ PDF multipágina exportado exitosamente');
  } catch (error) {
    console.error('Error al exportar PDF multipágina:', error);
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