import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import type { ExportOptions } from '../types';

/**
 * Exporta el canvas como imagen PNG
 */
export const exportAsPNG = async (
  element: HTMLElement,
  options: Partial<ExportOptions> = {}
): Promise<void> => {
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: options.transparent
        ? 'transparent'
        : options.backgroundColor || '#ffffff',
      quality: options.quality || 1,
      pixelRatio: 2,
    });

    // Descargar la imagen
    const link = document.createElement('a');
    link.download = `uniform-design-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error al exportar PNG:', error);
    throw error;
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
  try {
    const dataUrl = await toJpeg(element, {
      backgroundColor: options.backgroundColor || '#ffffff',
      quality: options.quality || 0.95,
      pixelRatio: 2,
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

    // Agregar la imagen ocupando todo el espacio del PDF
    pdf.addImage(dataUrl, 'JPEG', 0, 0, canvasWidthCm, canvasHeightCm);
    pdf.save(`uniform-design-${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    throw error;
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

    // Procesar cada página
    for (let i = 0; i < pages.length; i++) {
      const pageElement = pages[i];

      // Convertir la página a imagen
      const dataUrl = await toJpeg(pageElement, {
        backgroundColor: options.backgroundColor || '#ffffff',
        quality: options.quality || 0.95,
        pixelRatio: 2,
      });

      // Si no es la primera página, agregar una nueva página al PDF
      if (i > 0) {
        pdf.addPage([canvasWidthCm, canvasHeightCm]);
      }

      // Agregar la imagen a la página actual
      pdf.addImage(dataUrl, 'JPEG', 0, 0, canvasWidthCm, canvasHeightCm);
    }

    // Guardar el PDF
    pdf.save(`uniform-design-${Date.now()}.pdf`);
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