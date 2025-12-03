import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish, Size, UniformTemplate, TextElement } from "../types";
import { readExcelFile } from "./excelReader";
import { generateId } from "./canvas";
import { loadImage } from "./imageCache";
import { compressImageForCanvas } from "./imageCompressorForCanvas";
import { loadGoogleFont, getValidFontOrFallback } from "./fontLoader";

export interface ExcelProcessorCallbacks {
  onError: (title: string, message: string, details?: string[]) => void;
  onProgress: (current: number, total: number) => void;
  onStart: () => void;
  onComplete: (summary: { totalElements: number; pagesUsed: number }) => void;
}

export const processExcelFile = async (
  file: File,
  callbacks: ExcelProcessorCallbacks
): Promise<void> => {
  const { onError, onProgress, onStart, onComplete } = callbacks;

  try {
    // Leer el archivo Excel
    const rows = await readExcelFile(file);

    if (rows.length === 0) {
      onError("Archivo vacío", "El archivo Excel está vacío");
      return;
    }

    // Obtener funciones del store
    const {
      isSizeComplete,
      canvasConfig,
      addPage,
      sizeConfigs,
      setCanvasHidden,
      addElement
    } = useDesignerStore.getState();

    // Mapeo de tallas Excel a tallas en español
    const excelToSpanish: Record<string, SizeSpanish> = {
      'xs': 'XCH',
      'xch': 'XCH',
      's': 'CH',
      'ch': 'CH',
      'm': 'M',
      'l': 'G',
      'g': 'G',
      'xl': 'XG',
      'xg': 'XG',
      '2xl': '2XG',
      '2xg': '2XG',
      '3xl': '3XG',
      '3xg': '3XG',
    };

    // VALIDACIÓN: Verificar que todas las tallas del Excel tengan imágenes configuradas
    const tallasEnExcel = new Set<string>();
    const tallasSinConfiguracion: string[] = [];

    // Recopilar todas las tallas únicas del Excel
    rows.forEach(row => {
      const tallaExcel = (row.talla || '').toLowerCase().trim();
      if (tallaExcel) {
        tallasEnExcel.add(tallaExcel);
      }
    });

    // Verificar cada talla si tiene configuración completa
    const currentConfig = useDesignerStore.getState().uniformSizesConfig;
    tallasEnExcel.forEach(tallaExcel => {
      const tallaSpanish = excelToSpanish[tallaExcel];
      if (!tallaSpanish) {
        tallasSinConfiguracion.push(`"${tallaExcel}" - Talla no reconocida`);
      } else if (!isSizeComplete(tallaSpanish)) {
        const images = currentConfig[tallaSpanish];
        const faltantes: string[] = [];
        if (!images?.jerseyFront) faltantes.push('Playera Delantera');
        if (!images?.jerseyBack) faltantes.push('Playera Trasera');
        if (!images?.shortsLeft) faltantes.push('Short Izquierdo');
        if (!images?.shortsRight) faltantes.push('Short Derecho');

        tallasSinConfiguracion.push(
          `Talla "${tallaExcel.toUpperCase()}" - Faltan: ${faltantes.join(', ')}`
        );
      }
    });

    // Si hay tallas sin configuración, mostrar error y detener
    if (tallasSinConfiguracion.length > 0) {
      onError(
        "Tallas sin configurar",
        "El archivo Excel contiene tallas que no tienen imágenes configuradas. Por favor, configura las imágenes de todas las tallas antes de continuar.",
        tallasSinConfiguracion
      );
      return;
    }

    // Funciones auxiliares para obtener moldes
    const getMoldeFrenteUrl = (tallaExcel: string): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return "";

      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[tallaSpanish];
      return images?.jerseyFront || "";
    };

    const getMoldeEspaldaUrl = (tallaExcel: string): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return "";

      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[tallaSpanish];
      return images?.jerseyBack || "";
    };

    // Función auxiliar para obtener dimensiones reales de una imagen desde base64/URL
    const getImageDimensions = (imageUrl: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
          // Si falla, usar dimensiones por defecto
          resolve({ width: 380, height: 265 });
        };
        img.src = imageUrl;
      });
    };

    const getShortsConfig = async (tallaExcel: string): Promise<{
      left: { url: string; width: number; height: number };
      right: { url: string; width: number; height: number };
    }> => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) {
        return {
          left: { url: "", width: 380, height: 265 },
          right: { url: "", width: 380, height: 265 }
        };
      }

      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[tallaSpanish];

      // Obtener dimensiones reales de ambas imágenes
      const leftDimensions = images?.shortsLeft
        ? await getImageDimensions(images.shortsLeft)
        : { width: 380, height: 265 };

      const rightDimensions = images?.shortsRight
        ? await getImageDimensions(images.shortsRight)
        : { width: 380, height: 265 };

      return {
        left: { url: images?.shortsLeft || "", ...leftDimensions },
        right: { url: images?.shortsRight || "", ...rightDimensions }
      };
    };

    const getSizeConfig = (tallaExcel: string) => {
      const tallaUpper = tallaExcel.toUpperCase().trim();
      const talla = tallaUpper as Size;

      // Buscar la configuración exacta de la talla (ahora soportamos 2XL y 3XL)
      return sizeConfigs.find(s => s.size === talla) || sizeConfigs[2]; // Default M
    };

    // OCULTAR EL CANVAS
    setCanvasHidden(true);
    onStart();

    // Actualizar progreso inicial
    onProgress(0, rows.length);

    // Pequeño delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Pre-cargar imágenes
    console.log('Pre-cargando imágenes en caché...');
    const imagesToPreload = new Set<string>();

    const uniformSizesConfigOriginal = useDesignerStore.getState().uniformSizesConfig;
    rows.forEach(row => {
      const tallaExcel = (row.talla || 'm').toLowerCase().trim();
      const tallaSpanish = excelToSpanish[tallaExcel];
      if (tallaSpanish && uniformSizesConfigOriginal[tallaSpanish]) {
        const images = uniformSizesConfigOriginal[tallaSpanish];
        if (images.jerseyFront) imagesToPreload.add(images.jerseyFront);
        if (images.jerseyBack) imagesToPreload.add(images.jerseyBack);
        if (images.shortsLeft) imagesToPreload.add(images.shortsLeft);
        if (images.shortsRight) imagesToPreload.add(images.shortsRight);
      }
    });

    // Comprimir imágenes para el canvas
    console.log(`Comprimiendo ${imagesToPreload.size} imágenes para el canvas...`);
    const compressedConfig: any = {};

    for (const tallaSpanish of Object.keys(uniformSizesConfigOriginal) as SizeSpanish[]) {
      const images = uniformSizesConfigOriginal[tallaSpanish];
      if (images) {
        compressedConfig[tallaSpanish] = {};

        if (images.jerseyFront) {
          compressedConfig[tallaSpanish].jerseyFront = await compressImageForCanvas(images.jerseyFront);
        }
        if (images.jerseyBack) {
          compressedConfig[tallaSpanish].jerseyBack = await compressImageForCanvas(images.jerseyBack);
        }
        if (images.shortsLeft) {
          compressedConfig[tallaSpanish].shortsLeft = await compressImageForCanvas(images.shortsLeft);
        }
        if (images.shortsRight) {
          compressedConfig[tallaSpanish].shortsRight = await compressImageForCanvas(images.shortsRight);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Guardar imágenes comprimidas
    useDesignerStore.setState({ uniformSizesConfigCompressed: compressedConfig });
    console.log('✓ Imágenes comprimidas para canvas');

    // Pre-cargar imágenes comprimidas en caché
    console.log('Pre-cargando imágenes comprimidas en caché...');
    for (const url of imagesToPreload) {
      await new Promise<void>((resolve) => {
        loadImage(url, () => {
          resolve();
        });
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('✓ Todas las imágenes pre-cargadas en caché');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Obtener páginas actuales
    const { pages } = useDesignerStore.getState();
    let currentElements = pages[0] ? [...pages[0]] : [];
    let currentPageIndex = 0;

    // Procesar filas del Excel
    let processedCount = 0;
    const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;
    const elementGap = 5;

    // ============================================================
    // DEFINIR QUÉ TALLAS USAN QUÉ LAYOUT
    // ============================================================
    const tallasLayoutOriginal = ['XS', 'S', 'M', 'L'];      // 2 columnas horizontales
    const tallasLayoutOpcionA = ['XL', '2XL'];               // Playeras horizontales + shorts verticales

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.nombre || row.nombre.trim() === "") {
        continue;
      }

      const tallaExcel = row.talla || "m";
      const sizeConfig = getSizeConfig(tallaExcel);
      const tallaMostrar = tallaExcel.toUpperCase().trim();
      const fonteFila = getValidFontOrFallback(row.fuente, "Arial");

      if (fonteFila !== "Arial") {
        await loadGoogleFont(fonteFila);
      }

      const jerseyDimensions = {
        width: sizeConfig.width,
        height: sizeConfig.height,
      };

      const shortsConfig = await getShortsConfig(tallaExcel);
      const shortsDimensions = {
        width: sizeConfig.shortsWidth || sizeConfig.width * 0.45,
        height: sizeConfig.shortsHeight || (sizeConfig.width * 0.45) / (shortsConfig.left.width / shortsConfig.left.height),
      };

      // Determinar qué layout usar
      const usarLayoutOriginal = tallasLayoutOriginal.includes(tallaMostrar);
      const usarLayoutOpcionA = tallasLayoutOpcionA.includes(tallaMostrar);

      if (usarLayoutOriginal) {
        // ============================================================
        // LAYOUT ORIGINAL (XS-L): 2 columnas lado a lado
        // Columna 1: Par de playeras (frente + espalda) apilados verticalmente
        // Columna 2: Par de shorts (izq + der) apilados verticalmente
      processedCount++;

        // Buscar Y disponible para columna de jerseys
        const jerseysCol1 = currentElements.filter(
          el => el.type === "uniform" && el.part === "jersey" && el.position.x < jerseyDimensions.width + elementGap
        );

        let jerseyPairY = 0;
        if (jerseysCol1.length > 0) {
          jerseyPairY = Math.max(...jerseysCol1.map(j => j.position.y + j.dimensions.height)) + elementGap;
        }

        // Buscar Y disponible para columna de shorts
        const shortsCol2 = currentElements.filter(
          el => el.type === "uniform" && el.part === "shorts"
        );

        let shortsPairY = 0;
        if (shortsCol2.length > 0) {
          shortsPairY = Math.max(...shortsCol2.map(s => s.position.y + s.dimensions.height)) + elementGap;
        }

        // Usar el máximo Y para mantener alineación entre columnas
        const uniformY = Math.max(jerseyPairY, shortsPairY);

        // Calcular altura necesaria para el par más alto
        const jerseyPairHeight = jerseyDimensions.height * 2 + elementGap;
        const shortsPairHeight = shortsDimensions.height * 2 + elementGap;
        const maxPairHeight = Math.max(jerseyPairHeight, shortsPairHeight);

        // Verificar si cabe el uniforme completo
        if (uniformY + maxPairHeight > canvasHeight) {
          addPage();
          currentPageIndex++;
          currentElements = [];
        }

        // Recalcular Y después de posible cambio de página
        const finalUniformY = currentElements.length === 0 ? 0 : uniformY;

        // --- CREAR JERSEY FRENTE (columna 1, arriba) ---
        const jerseyFrentePos = { x: 0, y: finalUniformY };

        const newJerseyFrente: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyFrentePos,
          dimensions: jerseyDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: getMoldeFrenteUrl(tallaExcel),
        };

        currentElements.push(newJerseyFrente);
        addElement(newJerseyFrente, currentPageIndex);

        // Número en el frente
        if (row.numero_frente) {
          const numeroFrenteText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyFrentePos.x + jerseyDimensions.width / 2 - 15,
              y: jerseyFrentePos.y + jerseyDimensions.height * 0.45,
            },
            dimensions: { width: 30, height: 25 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_frente),
            fontFamily: fonteFila,
            fontSize: 24,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(numeroFrenteText);
          addElement(numeroFrenteText, currentPageIndex);
        }

        // --- CREAR JERSEY ESPALDA (columna 1, abajo del frente) ---
        const jerseyEspaldaPos = {
          x: 0,
          y: finalUniformY + jerseyDimensions.height + elementGap
        };

        const newJerseyEspalda: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyEspaldaPos,
          dimensions: jerseyDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: getMoldeEspaldaUrl(tallaExcel),
        };

        currentElements.push(newJerseyEspalda);
        addElement(newJerseyEspalda, currentPageIndex);

        // Número trasero
        if (row.numero_trasero) {
          const numeroEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 30,
              y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.35,
            },
            dimensions: { width: 60, height: 40 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_trasero),
            fontFamily: fonteFila,
            fontSize: 40,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(numeroEspaldaText);
          addElement(numeroEspaldaText, currentPageIndex);
        }

        // Nombre en la espalda
        if (row.nombre) {
          const nombreEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 60,
              y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.6,
            },
            dimensions: { width: 120, height: 30 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.nombre).toUpperCase(),
            fontFamily: fonteFila,
            fontSize: 16,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(nombreEspaldaText);
          addElement(nombreEspaldaText, currentPageIndex);
        }

        // Talla en la espalda
        const tallaEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: {
            x: jerseyEspaldaPos.x + jerseyDimensions.width * 0.8,
            y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.1,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 16,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "back",
        };

        currentElements.push(tallaEspaldaText);
        addElement(tallaEspaldaText, currentPageIndex);

        // --- CREAR SHORT IZQUIERDO (columna 2, arriba) ---
        const shortLeftPos = {
          x: jerseyDimensions.width + elementGap,
          y: finalUniformY
        };

        const newShortLeft: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: shortLeftPos,
          dimensions: shortsDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: shortsConfig.left.url,
          side: "left",
        };

        currentElements.push(newShortLeft);
        addElement(newShortLeft, currentPageIndex);

        // Talla en el short izquierdo
        const tallaShortLeftText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "shorts",
          size: tallaMostrar as any,
          position: {
            x: shortLeftPos.x + shortsDimensions.width / 2 - 20,
            y: shortLeftPos.y + shortsDimensions.height * 0.15,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 14,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "front",
        };

        currentElements.push(tallaShortLeftText);
        addElement(tallaShortLeftText, currentPageIndex);

        // --- CREAR SHORT DERECHO (columna 2, abajo, invertido 180°) ---
        const shortRightPos = {
          x: jerseyDimensions.width + elementGap,
          y: finalUniformY + shortsDimensions.height + elementGap
        };

        const newShortRight: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: shortRightPos,
          dimensions: shortsDimensions,
          rotation: 180,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: shortsConfig.right.url,
          side: "right",
        };

        currentElements.push(newShortRight);
        addElement(newShortRight, currentPageIndex);

        // Talla en el short derecho (rotado 180°)
        const tallaShortRightText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "shorts",
          size: tallaMostrar as any,
          position: {
            x: shortRightPos.x + shortsDimensions.width / 2 - 20,
            y: shortRightPos.y + shortsDimensions.height * 0.85,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 180,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 14,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "front",
        };

        currentElements.push(tallaShortRightText);
        addElement(tallaShortRightText, currentPageIndex);

      } else if (usarLayoutOpcionA) {
        // ============================================================
        // LAYOUT OPCIÓN A (XL-2XL): 3 filas
        // Fila 1: Playeras horizontales (frente izq + espalda der)
        // Fila 2: Short izquierdo solo
        // Fila 3: Short derecho solo
        // ============================================================

        // Buscar Y disponible (buscar el máximo Y de TODOS los elementos)
        let currentY = 0;
        if (currentElements.length > 0) {
          currentY = Math.max(...currentElements.map(el => el.position.y + el.dimensions.height)) + elementGap;
        }

        // Calcular altura total necesaria (playeras en fila + 2 shorts verticales)
        const totalHeight = jerseyDimensions.height + (shortsDimensions.height * 2) + (elementGap * 2);

        // Verificar si cabe el uniforme completo
        if (currentY + totalHeight > canvasHeight) {
          addPage();
          currentPageIndex++;
          currentElements = [];
          currentY = 0;
        }

        // --- FILA 1: PLAYERAS HORIZONTALES ---
        
        // JERSEY FRENTE (izquierda)
        const jerseyFrentePos = { x: 0, y: currentY };

        const newJerseyFrente: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyFrentePos,
          dimensions: jerseyDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: getMoldeFrenteUrl(tallaExcel),
        };

        currentElements.push(newJerseyFrente);
        addElement(newJerseyFrente, currentPageIndex);

        // Número en el frente
        if (row.numero_frente) {
          const numeroFrenteText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyFrentePos.x + jerseyDimensions.width / 2 - 15,
              y: jerseyFrentePos.y + jerseyDimensions.height * 0.45,
            },
            dimensions: { width: 30, height: 25 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_frente),
            fontFamily: fonteFila,
            fontSize: 24,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(numeroFrenteText);
          addElement(numeroFrenteText, currentPageIndex);
        }

        // JERSEY ESPALDA (derecha, al lado del frente)
        const jerseyEspaldaPos = {
          x: jerseyDimensions.width + elementGap,
          y: currentY
        };

        const newJerseyEspalda: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyEspaldaPos,
          dimensions: jerseyDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: getMoldeEspaldaUrl(tallaExcel),
        };

        currentElements.push(newJerseyEspalda);
        addElement(newJerseyEspalda, currentPageIndex);

        // Número trasero
        if (row.numero_trasero) {
          const numeroEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 30,
              y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.35,
            },
            dimensions: { width: 60, height: 40 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_trasero),
            fontFamily: fonteFila,
            fontSize: 40,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(numeroEspaldaText);
          addElement(numeroEspaldaText, currentPageIndex);
        }

        // Nombre en la espalda
        if (row.nombre) {
          const nombreEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 60,
              y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.6,
            },
            dimensions: { width: 120, height: 30 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.nombre).toUpperCase(),
            fontFamily: fonteFila,
            fontSize: 16,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(nombreEspaldaText);
          addElement(nombreEspaldaText, currentPageIndex);
        }

        // Talla en la espalda
        const tallaEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: {
            x: jerseyEspaldaPos.x + jerseyDimensions.width * 0.8,
            y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.1,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 16,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "back",
        };

        currentElements.push(tallaEspaldaText);
        addElement(tallaEspaldaText, currentPageIndex);

        // --- FILA 2: SHORT IZQUIERDO (solo, 0°) ---
        const shortLeftY = currentY + jerseyDimensions.height + elementGap;
        const shortLeftPos = { x: 0, y: shortLeftY };

        const newShortLeft: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: shortLeftPos,
          dimensions: shortsDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: shortsConfig.left.url,
          side: "left",
        };

        currentElements.push(newShortLeft);
        addElement(newShortLeft, currentPageIndex);

        // Talla en el short izquierdo
        const tallaShortLeftText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "shorts",
          size: tallaMostrar as any,
          position: {
            x: shortLeftPos.x + shortsDimensions.width / 2 - 20,
            y: shortLeftPos.y + shortsDimensions.height * 0.15,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 14,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "front",
        };

        currentElements.push(tallaShortLeftText);
        addElement(tallaShortLeftText, currentPageIndex);

        // --- FILA 3: SHORT DERECHO (solo, 180°) ---
        const shortRightY = shortLeftY + shortsDimensions.height + elementGap;
        const shortRightPos = { x: 0, y: shortRightY };

        const newShortRight: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: shortRightPos,
          dimensions: shortsDimensions,
          rotation: 180,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: shortsConfig.right.url,
          side: "right",
        };

        currentElements.push(newShortRight);
        addElement(newShortRight, currentPageIndex);

        // Talla en el short derecho (rotado 180°)
        const tallaShortRightText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "shorts",
          size: tallaMostrar as any,
          position: {
            x: shortRightPos.x + shortsDimensions.width / 2 - 20,
            y: shortRightPos.y + shortsDimensions.height * 0.85,
          },
          dimensions: { width: 40, height: 20 },
          rotation: 180,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: tallaMostrar,
          fontFamily: "Arial",
          fontSize: 14,
          fontColor: "#666666",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "front",
        };

        currentElements.push(tallaShortRightText);
        addElement(tallaShortRightText, currentPageIndex);
      }

      onProgress(processedCount, rows.length);

      // Pausa entre uniformes
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Mostrar canvas
    setCanvasHidden(false);

    // Completar
    const totalPages = useDesignerStore.getState().pages.length;
    onComplete({
      totalElements: processedCount * 4, // jerseys (front + back) + shorts (left + right)
      pagesUsed: totalPages,
    });

  } catch (error) {
    console.error('Error al procesar Excel:', error);
    onError(
      "Error de procesamiento",
      "Ocurrió un error al procesar el archivo Excel. Por favor, verifica el formato del archivo.",
      [error instanceof Error ? error.message : String(error)]
    );
  }
};
