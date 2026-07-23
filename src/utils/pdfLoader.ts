import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  workerConfigured = true;
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
}

/**
 * Renderiza una página de un PDF a PNG usando PDF.js.
 * Usa el motor de renderizado ICC propio de PDF.js, lo que produce
 * colores mucho más fieles al original de CorelDraw que rasterizar
 * un SVG con el canvas HTML5 del browser.
 *
 * @param pdfBytes - Bytes crudos del archivo PDF
 * @param pageIndex - Índice de página base-0 (default: 0 = primera página)
 * @param scale    - Factor de escala sobre los 72 DPI nativos del PDF.
 *                   scale=6 → ~432 DPI efectivos (recomendado para moldes de impresión)
 * @returns Data URL PNG lista para usar en el canvas o en exportación
 */
export async function renderPdfPageToPng(
  pdfBytes: Uint8Array,
  pageIndex = 0,
  scale = 6,
): Promise<string> {
  ensureWorker();

  const loadingTask = getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  const page = await pdf.getPage(pageIndex + 1); // PDF.js usa índice base-1

  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = Math.floor(viewport.width);
  canvas.height  = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear contexto 2D para renderizar PDF');

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const pngDataUrl = canvas.toDataURL('image/png');

  // Liberar recursos de la página y el documento
  page.cleanup();
  await pdf.cleanup();

  return pngDataUrl;
}
