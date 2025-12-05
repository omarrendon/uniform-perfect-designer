/**
 * Sistema de marcas de impresión profesional
 * Incluye crop marks, registration marks, color bars
 */

import { PDFDocument, PDFPage, rgb, cmyk, StandardFonts } from 'pdf-lib';

export interface PrintMarksOptions {
  addCropMarks?: boolean;
  addRegistrationMarks?: boolean;
  addColorBars?: boolean;
  addBleedMarks?: boolean;
  addJobInfo?: boolean;
  bleedSize?: number; // en puntos (default: 9 points = ~3mm)
  markOffset?: number; // distancia de las marcas al borde (default: 6 points)
  jobInfo?: {
    title?: string;
    date?: string;
    profile?: string;
    tac?: string;
  };
}

/**
 * Agrega marcas de impresión profesionales a una página PDF
 */
export const addPrintMarks = async (
  pdfDoc: PDFDocument,
  page: PDFPage,
  options: PrintMarksOptions = {}
): Promise<void> => {
  const {
    addCropMarks = true,
    addRegistrationMarks = true,
    addColorBars = true,
    addBleedMarks = false,
    addJobInfo = true,
    bleedSize = 9, // ~3mm
    markOffset = 6,
  } = options;

  const { width, height } = page.getSize();
  const markLength = 12; // Longitud de las marcas en puntos

  // Embeber fuente para información
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. CROP MARKS (Marcas de corte)
  if (addCropMarks) {
    const cropOffset = markOffset;

    // Esquina superior izquierda
    page.drawLine({
      start: { x: -cropOffset - markLength, y: height },
      end: { x: -cropOffset, y: height },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: 0, y: height + cropOffset },
      end: { x: 0, y: height + cropOffset + markLength },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });

    // Esquina superior derecha
    page.drawLine({
      start: { x: width + cropOffset, y: height },
      end: { x: width + cropOffset + markLength, y: height },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: width, y: height + cropOffset },
      end: { x: width, y: height + cropOffset + markLength },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });

    // Esquina inferior izquierda
    page.drawLine({
      start: { x: -cropOffset - markLength, y: 0 },
      end: { x: -cropOffset, y: 0 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: 0, y: -cropOffset },
      end: { x: 0, y: -cropOffset - markLength },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });

    // Esquina inferior derecha
    page.drawLine({
      start: { x: width + cropOffset, y: 0 },
      end: { x: width + cropOffset + markLength, y: 0 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: width, y: -cropOffset },
      end: { x: width, y: -cropOffset - markLength },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
  }

  // 2. REGISTRATION MARKS (Cruces de registro)
  if (addRegistrationMarks) {
    const regSize = 6; // Tamaño de la cruz
    const regOffset = markOffset + markLength + 6;

    // Función para dibujar cruz de registro
    const drawRegistrationMark = (x: number, y: number) => {
      // Cruz
      page.drawLine({
        start: { x: x - regSize, y },
        end: { x: x + regSize, y },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });
      page.drawLine({
        start: { x, y: y - regSize },
        end: { x, y: y + regSize },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });
      // Círculo
      page.drawCircle({
        x,
        y,
        size: regSize - 1,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
    };

    // Arriba centro
    drawRegistrationMark(width / 2, height + regOffset);
    // Abajo centro
    drawRegistrationMark(width / 2, -regOffset);
    // Izquierda centro
    drawRegistrationMark(-regOffset, height / 2);
    // Derecha centro
    drawRegistrationMark(width + regOffset, height / 2);
  }

  // 3. COLOR BARS (Barras de color para calibración)
  if (addColorBars) {
    const barHeight = 8;
    const barY = -markOffset - markLength - 15;
    const barWidth = width / 14; // 14 secciones

    // Barras CMYK y grises
    const colorSamples = [
      { c: 1, m: 0, y: 0, k: 0, label: 'C' },
      { c: 0, m: 1, y: 0, k: 0, label: 'M' },
      { c: 0, m: 0, y: 1, k: 0, label: 'Y' },
      { c: 0, m: 0, y: 0, k: 1, label: 'K' },
      { c: 1, m: 1, y: 0, k: 0, label: 'C+M' },
      { c: 1, m: 0, y: 1, k: 0, label: 'C+Y' },
      { c: 0, m: 1, y: 1, k: 0, label: 'M+Y' },
      { c: 0.5, m: 0.5, y: 0.5, k: 0, label: '50%' },
      { c: 0.25, m: 0.25, y: 0.25, k: 0, label: '25%' },
      { c: 0.75, m: 0.75, y: 0.75, k: 0, label: '75%' },
      { c: 0, m: 0, y: 0, k: 0.5, label: 'K50' },
      { c: 1, m: 1, y: 1, k: 0, label: 'CMY' },
      { c: 1, m: 1, y: 1, k: 1, label: 'Rich' },
      { c: 0, m: 0, y: 0, k: 0, label: 'W' },
    ];

    colorSamples.forEach((sample, index) => {
      page.drawRectangle({
        x: index * barWidth,
        y: barY,
        width: barWidth,
        height: barHeight,
        color: cmyk(sample.c, sample.m, sample.y, sample.k),
      });

      // Etiqueta
      page.drawText(sample.label, {
        x: index * barWidth + 2,
        y: barY - 8,
        size: 5,
        font,
        color: rgb(0, 0, 0),
      });
    });
  }

  // 4. JOB INFORMATION (Información del trabajo)
  if (addJobInfo && options.jobInfo) {
    const infoY = height + markOffset + markLength + 8;
    const fontSize = 6;
    let infoText = '';

    if (options.jobInfo.title) {
      infoText += `Job: ${options.jobInfo.title} | `;
    }
    if (options.jobInfo.date) {
      infoText += `Date: ${options.jobInfo.date} | `;
    }
    if (options.jobInfo.profile) {
      infoText += `Profile: ${options.jobInfo.profile} | `;
    }
    if (options.jobInfo.tac) {
      infoText += `TAC: ${options.jobInfo.tac}%`;
    }

    page.drawText(infoText, {
      x: 0,
      y: infoY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  // 5. BLEED MARKS (Marcas de sangrado) - Opcional
  if (addBleedMarks) {
    // Líneas punteadas indicando el área de sangrado
    const dashLength = 2;
    const gapLength = 2;

    // Solo dibujamos las esquinas para indicar el bleed
    for (let i = 0; i < 20; i += dashLength + gapLength) {
      // Superior izquierda
      page.drawLine({
        start: { x: -bleedSize + i, y: height + bleedSize },
        end: { x: -bleedSize + i + dashLength, y: height + bleedSize },
        thickness: 0.25,
        color: rgb(0, 0, 1), // Azul para distinguir
      });
    }
  }
};

/**
 * Expande el tamaño de la página para acomodar las marcas de impresión
 */
export const expandPageForMarks = (
  page: PDFPage,
  options: PrintMarksOptions = {}
): { width: number; height: number } => {
  const { markOffset = 6 } = options;

  const currentSize = page.getSize();
  const extraSpace = markOffset + 30; // Espacio adicional para marcas

  const newWidth = currentSize.width + extraSpace * 2;
  const newHeight = currentSize.height + extraSpace * 2;

  // Redimensionar página
  page.setSize(newWidth, newHeight);

  // Ajustar posición del contenido (mover al centro)
  page.translateContent(extraSpace, extraSpace);

  return { width: newWidth, height: newHeight };
};

/**
 * Genera nombre de archivo con información de impresión
 */
export const generatePrintFileName = (
  baseName: string,
  profile: string,
  tac: number
): string => {
  const timestamp = Date.now();
  return `${baseName}-${profile}-TAC${Math.round(tac)}-${timestamp}.pdf`;
};
