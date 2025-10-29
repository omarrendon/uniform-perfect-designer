import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { ExportOptions } from '@/types';

/**
 * Exporta el canvas como imagen PNG
 */
export const exportAsPNG = async (
  element: HTMLElement,
  options: ExportOptions = {}
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
 */
export const exportAsPDF = async (
  element: HTMLElement,
  options: ExportOptions = {}
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

    // Crear PDF en orientación landscape para mejor ajuste
    const pdf = new jsPDF({
      orientation: img.width > img.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.width, img.height],
    });

    pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
    pdf.save(`uniform-design-${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
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