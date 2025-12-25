import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish, Size, UniformTemplate, TextElement } from "../types";
import { readExcelFile } from "./excelReader";
import { generateId } from "./canvas";
import { loadImage } from "./imageCache";
import { compressImageForCanvas } from "./imageCompressorForCanvas";
import { loadFont, getValidFontOrFallback } from "./fontLoader";

export interface ExcelProcessorCallbacks {
  onError: (title: string, message: string, details?: string[]) => void;
  onProgress: (current: number, total: number) => void;
  onStart: () => void;
  onComplete: (summary: { totalElements: number; pagesUsed: number }) => void;
}

/**
 * Parsea y valida el tamaño de fuente desde Excel
 * @param valor - Valor del Excel (puede ser número o string)
 * @param defaultSize - Tamaño por defecto si no es válido
 * @returns Tamaño de fuente válido (mínimo 8, sin máximo)
 */
const parseFontSize = (valor: any, defaultSize: number): number => {
  if (!valor) return defaultSize;

  const size = typeof valor === 'number' ? valor : parseInt(String(valor), 10);

  if (isNaN(size) || size < 8) {
    return defaultSize;
  }

  return size;
};

/**
 * Parsea y valida el color desde Excel
 * @param valor - Valor del Excel (puede ser "#FF0000", "FF0000", etc.)
 * @param defaultColor - Color por defecto si no es válido
 * @returns Color en formato hexadecimal "#RRGGBB"
 */
const parseColor = (valor: any, defaultColor: string): string => {
  if (!valor) return defaultColor;

  let color = String(valor).trim();

  // Si no empieza con #, agregarlo
  if (!color.startsWith('#')) {
    color = '#' + color;
  }

  // Validar formato hexadecimal (debe ser #RRGGBB)
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(color)) {
    return defaultColor;
  }

  // Normalizar a mayúsculas
  return color.toUpperCase();
};

/**
 * Configuración de posiciones y tamaños exactos por talla
 * Estas coordenadas son RELATIVAS a la posición base del uniforme
 */
interface TextPositionConfig {
  // Posición relativa al inicio del uniforme (offset desde jerseyFrentePos)
  offsetX: number;
  offsetY: number;
  fontSize: number;
}

interface SizeTextConfig {
  jerseyFront: TextPositionConfig;      // Número en jersey delantera
  jerseyBackNumber: TextPositionConfig; // Número en jersey trasera
  jerseyBackName: TextPositionConfig;   // Nombre en jersey trasera
  shortsRight: TextPositionConfig;      // Número en short derecho
}

const TEXT_POSITIONS_BY_SIZE: Record<string, SizeTextConfig> = {
  'M': {
    jerseyFront: {
      offsetX: 330,      // Offset desde jerseyFrentePos
      offsetY: 116,
      fontSize: 116.76
    },
    jerseyBackNumber: {
      offsetX: 148,      // Offset desde jerseyEspaldaPos
      offsetY: 204,      // 998 - ~794 (posición estimada de jerseyEspaldaPos)
      fontSize: 319.02
    },
    jerseyBackName: {
      offsetX: 189,      // Offset desde jerseyEspaldaPos
      offsetY: 130,      // 924 - ~794 (posición estimada de jerseyEspaldaPos)
      fontSize: 94.59
    },
    shortsRight: {
      offsetX: 337,      // 911 - 574 (posición base del short)
      offsetY: 308,      // 915 - 607 (posición base del short)
      fontSize: 150.47
    }
  },
  'L': {
    jerseyFront: {
      offsetX: 347,
      offsetY: 1718,
      fontSize: 121.46
    },
    jerseyBackNumber: {
      offsetX: 152,
      offsetY: 2663,
      fontSize: 328.77
    },
    jerseyBackName: {
      offsetX: 137,
      offsetY: 933,
      fontSize: 84.92
    },
    shortsRight: {
      offsetX: 964,
      offsetY: 2550,
      fontSize: 156.42
    }
  }
};

/**
 * Obtiene la configuración de posiciones de texto para una talla específica
 * Si no existe configuración para la talla, retorna null (usar posiciones calculadas)
 */
const getTextPositionConfig = (tallaMapeada: string): SizeTextConfig | null => {
  return TEXT_POSITIONS_BY_SIZE[tallaMapeada] || null;
};

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

    // Debug: Ver todas las columnas leídas del Excel
    if (rows.length > 0) {
      console.log("🔍 COLUMNAS ENCONTRADAS EN EL EXCEL:", Object.keys(rows[0]));
      console.log("📄 PRIMERA FILA COMPLETA:", rows[0]);
    }

    // Obtener funciones del store
    const {
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

    // Mapeo de género Excel a tipo Gender
    const excelToGender = (generoExcel: string | undefined): 'Hombre' | 'Mujer' => {
      if (!generoExcel) return 'Hombre'; // Por defecto Hombre si no se especifica
      const generoLower = generoExcel.toLowerCase().trim();
      if (generoLower === 'mujer' || generoLower === 'm' || generoLower === 'f' || generoLower === 'femenino') {
        return 'Mujer';
      }
      return 'Hombre'; // Por defecto Hombre
    };

    // Helper para crear key compuesta (género-talla) ej: "H-XCH", "M-CH"
    const createSizeKey = (gender: 'Hombre' | 'Mujer', sizeSpanish: SizeSpanish): string => {
      const genderPrefix = gender === 'Hombre' ? 'H' : 'M';
      return `${genderPrefix}-${sizeSpanish}`;
    };

    // VALIDACIÓN: Verificar que todas las combinaciones talla+género del Excel tengan imágenes configuradas
    const tallasGeneroEnExcel = new Set<string>();
    const tallasSinConfiguracion: string[] = [];

    // Recopilar todas las combinaciones talla+género únicas del Excel
    rows.forEach(row => {
      const tallaExcel = (row.talla || '').toLowerCase().trim();
      const genero = excelToGender(row.genero);
      if (tallaExcel) {
        const tallaSpanish = excelToSpanish[tallaExcel];
        if (tallaSpanish) {
          const key = createSizeKey(genero, tallaSpanish);
          tallasGeneroEnExcel.add(key);
        }
      }
    });

    // Verificar cada combinación talla+género si tiene configuración completa
    const currentConfig = useDesignerStore.getState().uniformSizesConfig;
    tallasGeneroEnExcel.forEach(sizeKey => {
      const images = currentConfig[sizeKey];
      if (!images) {
        tallasSinConfiguracion.push(`"${sizeKey}" - Sin configuración de imágenes`);
      } else {
        const faltantes: string[] = [];
        if (!images.jerseyFront) faltantes.push('Playera Delantera');
        if (!images.jerseyBack) faltantes.push('Playera Trasera');
        if (!images.shortsLeft) faltantes.push('Short Izquierdo');
        if (!images.shortsRight) faltantes.push('Short Derecho');

        if (faltantes.length > 0) {
          tallasSinConfiguracion.push(
            `"${sizeKey}" - Faltan: ${faltantes.join(', ')}`
          );
        }
      }
    });

    // Si hay tallas sin configuración, mostrar error y detener
    if (tallasSinConfiguracion.length > 0) {
      onError(
        "Tallas sin configurar",
        "El archivo Excel contiene combinaciones de talla y género que no tienen imágenes configuradas. Por favor, configura las imágenes antes de continuar.",
        tallasSinConfiguracion
      );
      return;
    }

    // Funciones auxiliares para obtener moldes (con género)
    const getMoldeFrenteUrl = (tallaExcel: string, genero: 'Hombre' | 'Mujer'): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return "";

      const sizeKey = createSizeKey(genero, tallaSpanish);
      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[sizeKey];
      return images?.jerseyFront || "";
    };

    const getMoldeEspaldaUrl = (tallaExcel: string, genero: 'Hombre' | 'Mujer'): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return "";

      const sizeKey = createSizeKey(genero, tallaSpanish);
      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[sizeKey];
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

    const getShortsConfig = async (tallaExcel: string, genero: 'Hombre' | 'Mujer'): Promise<{
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

      const sizeKey = createSizeKey(genero, tallaSpanish);
      const { uniformSizesConfigCompressed } = useDesignerStore.getState(); // Usar imágenes COMPRIMIDAS para canvas
      const images = uniformSizesConfigCompressed[sizeKey];

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

    const getSizeConfig = (tallaExcel: string, genero: 'Hombre' | 'Mujer') => {
      const tallaUpper = tallaExcel.toUpperCase().trim();

      // Mapeo de tallas en español a inglés
      const tallaMapping: { [key: string]: Size } = {
        // Español
        'XCH': 'XS',
        'CH': 'S',
        'M': 'M',
        'G': 'L',      // ← CRÍTICO: Grande = Large
        'XG': 'XL',
        '2XG': 'XL',
        '3XG': 'XL',
        // Inglés (también soportado)
        'XS': 'XS',
        'S': 'S',
        'L': 'L',
        'XL': 'XL',
        '2XL': 'XL',
        '3XL': 'XL',
      };

      // Obtener talla mapeada o usar la original
      const tallaMapped = tallaMapping[tallaUpper] || tallaUpper as Size;

      // Usar la función del store para obtener configuración por talla y género
      const config = useDesignerStore.getState().getSizeConfig(tallaMapped, genero);

      // Si no encuentra, usar configuración por defecto (M Hombre)
      return config || useDesignerStore.getState().getSizeConfig('M', 'Hombre') || sizeConfigs[0];
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
      const genero = excelToGender(row.genero);
      const tallaSpanish = excelToSpanish[tallaExcel];
      if (tallaSpanish) {
        const sizeKey = createSizeKey(genero, tallaSpanish);
        const images = uniformSizesConfigOriginal[sizeKey];
        if (images) {
          if (images.jerseyFront) imagesToPreload.add(images.jerseyFront);
          if (images.jerseyBack) imagesToPreload.add(images.jerseyBack);
          if (images.shortsLeft) imagesToPreload.add(images.shortsLeft);
          if (images.shortsRight) imagesToPreload.add(images.shortsRight);
        }
      }
    });

    // Comprimir imágenes para el canvas
    console.log(`Comprimiendo ${imagesToPreload.size} imágenes para el canvas...`);
    const compressedConfig: any = {};

    for (const sizeKey of Object.keys(uniformSizesConfigOriginal)) {
      const images = uniformSizesConfigOriginal[sizeKey];
      if (images) {
        compressedConfig[sizeKey] = {};

        if (images.jerseyFront) {
          compressedConfig[sizeKey].jerseyFront = await compressImageForCanvas(images.jerseyFront);
        }
        if (images.jerseyBack) {
          compressedConfig[sizeKey].jerseyBack = await compressImageForCanvas(images.jerseyBack);
        }
        if (images.shortsLeft) {
          compressedConfig[sizeKey].shortsLeft = await compressImageForCanvas(images.shortsLeft);
        }
        if (images.shortsRight) {
          compressedConfig[sizeKey].shortsRight = await compressImageForCanvas(images.shortsRight);
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
      const genero = excelToGender(row.genero); // Extraer género del Excel
      const sizeConfig = getSizeConfig(tallaExcel, genero);
      const tallaMostrar = tallaExcel.toUpperCase().trim();

      // Obtener la talla mapeada (para decisiones de layout)
      const tallaMapping: { [key: string]: Size } = {
        'XCH': 'XS', 'CH': 'S', 'M': 'M',
        'G': 'L', 'XG': 'XL', '2XG': 'XL', '3XG': 'XL',
        'XS': 'XS', 'S': 'S', 'L': 'L',
        'XL': 'XL', '2XL': 'XL', '3XL': 'XL',
      };
      const tallaMapeada = tallaMapping[tallaMostrar] || tallaMostrar;

      const fonteFila = getValidFontOrFallback(row.fuente, "Arial");

      if (fonteFila !== "Arial") {
        await loadFont(fonteFila);
      }

      // Parsear tamaños de fuente y colores desde Excel (con valores por defecto)
      const tamanoNumeroFrente = parseFontSize(row.tamano_numero_frente, 24);
      const colorNumeroFrente = parseColor(row.color_numero_frente, "#000000");
      const tamanoNumeroEspalda = parseFontSize(row.tamano_numero_espalda, 40);
      const colorNumeroEspalda = parseColor(row.color_numero_espalda, "#000000");
      const tamanoNombreEspalda = parseFontSize(row.tamano_nombre_espalda, 16);
      const colorNombreEspalda = parseColor(row.color_nombre_espalda, "#000000");
      const tamanoNumeroShort = parseFontSize(row.tamano_numero_short, 30);
      const colorNumeroShort = parseColor(row.color_numero_short, "#000000");

      // Debug: Ver qué valores se están leyendo del Excel
      console.log(`[${row.nombre}] Talla Excel: ${tallaMostrar} → Talla Mapeada: ${tallaMapeada}`);
      console.log(`[${row.nombre}] Valores Excel:`, {
        tamano_numero_espalda: row.tamano_numero_espalda,
        color_numero_espalda: row.color_numero_espalda,
        tamano_nombre_espalda: row.tamano_nombre_espalda,
        color_nombre_espalda: row.color_nombre_espalda
      });
      console.log(`[${row.nombre}] Valores parseados:`, {
        tamanoNumeroEspalda,
        colorNumeroEspalda,
        tamanoNombreEspalda,
        colorNombreEspalda
      });

      const jerseyDimensions = {
        width: sizeConfig.width,
        height: sizeConfig.height,
      };

      const shortsConfig = await getShortsConfig(tallaExcel, genero);
      const shortsDimensions = {
        width: sizeConfig.shortsWidth || sizeConfig.width * 0.45,
        height: sizeConfig.shortsHeight || (sizeConfig.width * 0.45) / (shortsConfig.left.width / shortsConfig.left.height),
      };

      // Obtener configuración de posiciones de texto para esta talla
      const textPosConfig = getTextPositionConfig(tallaMapeada);

      // Determinar qué layout usar (usar talla MAPEADA, no la del Excel)
      const usarLayoutOriginal = tallasLayoutOriginal.includes(tallaMapeada);
      const usarLayoutOpcionA = tallasLayoutOpcionA.includes(tallaMapeada);

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
          console.log(`🆕 [Layout Predeterminado] Creando nueva página. Uniforme: ${row.nombre}, Talla: ${tallaMostrar}`);
          addPage();
          currentPageIndex++;
          // Sincronizar currentElements con el estado real de la nueva página
          const { pages: updatedPages } = useDesignerStore.getState();
          console.log(`   Total páginas: ${updatedPages.length}, currentPageIndex: ${currentPageIndex}`);
          currentElements = updatedPages[currentPageIndex] ? [...updatedPages[currentPageIndex]] : [];
          console.log(`   Elementos en nueva página: ${currentElements.length}`);
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
          imageUrl: getMoldeFrenteUrl(tallaExcel, genero),
          source: 'excel',
        };

        currentElements.push(newJerseyFrente);
        addElement(newJerseyFrente, currentPageIndex);

        // Número en el frente (pecho derecho, 10cm más arriba, ajustado según dígitos)
        if (row.numero) {
          // Usar posición configurada o calcular
          let numeroFrenteX, numeroFrenteY, numeroFrenteFontSize;

          if (textPosConfig) {
            // Usar offsets relativos a la posición del jersey frente
            numeroFrenteX = jerseyFrentePos.x + textPosConfig.jerseyFront.offsetX;
            numeroFrenteY = jerseyFrentePos.y + textPosConfig.jerseyFront.offsetY;
            numeroFrenteFontSize = textPosConfig.jerseyFront.fontSize;
          } else {
            // Posición calculada (código original)
            const numeroStr = String(row.numero);
            const cantidadDigitos = numeroStr.length;
            const ajusteDigitos = cantidadDigitos === 1 ? 20 : -20;
            numeroFrenteX = jerseyFrentePos.x + jerseyDimensions.width * 0.75 - 85 + ajusteDigitos;
            numeroFrenteY = jerseyFrentePos.y + jerseyDimensions.height * 0.30 - 100;
            numeroFrenteFontSize = tamanoNumeroFrente;
          }

          const numeroFrenteText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: numeroFrenteX,
              y: numeroFrenteY,
            },
            dimensions: { width: 30, height: 25 },
            rotation: 0,
            zIndex: currentElements.length + 1000, // zIndex alto para estar al frente
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: numeroFrenteFontSize,
            fontColor: colorNumeroFrente,
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
          imageUrl: getMoldeEspaldaUrl(tallaExcel, genero),
          source: 'excel',
        };

        currentElements.push(newJerseyEspalda);
        addElement(newJerseyEspalda, currentPageIndex);

        // Número trasero (10cm a la izquierda)
        if (row.numero) {
          // Usar posición configurada o calcular
          let numeroEspaldaX, numeroEspaldaY, numeroEspaldaFontSize;

          if (textPosConfig) {
            // Usar offsets relativos a la posición del jersey espalda
            numeroEspaldaX = jerseyEspaldaPos.x + textPosConfig.jerseyBackNumber.offsetX;
            numeroEspaldaY = jerseyEspaldaPos.y + textPosConfig.jerseyBackNumber.offsetY;
            numeroEspaldaFontSize = textPosConfig.jerseyBackNumber.fontSize;
          } else {
            // Posición calculada (código original)
            numeroEspaldaX = jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 130;
            numeroEspaldaY = jerseyEspaldaPos.y + jerseyDimensions.height * 0.35;
            numeroEspaldaFontSize = tamanoNumeroEspalda;
          }

          const numeroEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: numeroEspaldaX,
              y: numeroEspaldaY,
            },
            dimensions: { width: 60, height: 40 },
            rotation: 0,
            zIndex: currentElements.length + 1000, // zIndex alto para estar al frente
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: numeroEspaldaFontSize,
            fontColor: colorNumeroEspalda,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(numeroEspaldaText);
          addElement(numeroEspaldaText, currentPageIndex);
        }

        // Nombre en la espalda (13cm abajo desde la parte superior, 6cm a la izquierda)
        if (row.nombre) {
          // Usar posición configurada o calcular
          let nombreEspaldaX, nombreEspaldaY, nombreEspaldaFontSize;

          if (textPosConfig) {
            // Usar offsets relativos a la posición del jersey espalda
            nombreEspaldaX = jerseyEspaldaPos.x + textPosConfig.jerseyBackName.offsetX;
            nombreEspaldaY = jerseyEspaldaPos.y + textPosConfig.jerseyBackName.offsetY;
            nombreEspaldaFontSize = textPosConfig.jerseyBackName.fontSize;
          } else {
            // Posición calculada (código original)
            nombreEspaldaX = jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 120;
            nombreEspaldaY = jerseyEspaldaPos.y + 130;
            nombreEspaldaFontSize = tamanoNombreEspalda;
          }

          // Ajustar tamaño de fuente según longitud del nombre para que quepa en el jersey
          const nombreTexto = String(row.nombre).toUpperCase();

          // SOLO PARA TALLA M: Mover nombre a la izquierda según cantidad de letras
          if (textPosConfig && tallaMapeada === 'M' && nombreTexto.length > 5) {
            let desplazamientoIzquierda = 0;
            let desplazamientoAbajo = 0;

            if (nombreTexto.length >= 6 && nombreTexto.length <= 7) {
              desplazamientoIzquierda = 40;
            } else if (nombreTexto.length >= 8) {
              desplazamientoIzquierda = 45;
              desplazamientoAbajo = 15; // Bajar 15px para nombres muy largos
            }

            nombreEspaldaX = nombreEspaldaX - desplazamientoIzquierda;
            nombreEspaldaY = nombreEspaldaY + desplazamientoAbajo;
            console.log(`⬅️ [DESPLAZAMIENTO NOMBRE] "${nombreTexto}" (${nombreTexto.length} letras) | Desplazado ${desplazamientoIzquierda}px izq, ${desplazamientoAbajo}px abajo | Nueva pos: (${Math.round(nombreEspaldaX)}, ${Math.round(nombreEspaldaY)})`);
          }
          const anchoMaximoNombre = jerseyDimensions.width * 0.75; // 75% del ancho del jersey
          const anchoAproximadoTexto = nombreEspaldaFontSize * nombreTexto.length * 0.75; // Factor 0.75 para fuentes bold

          if (anchoAproximadoTexto > anchoMaximoNombre) {
            // Reducir proporcionalmente el tamaño de fuente
            const factorReduccion = anchoMaximoNombre / anchoAproximadoTexto;
            nombreEspaldaFontSize = Math.max(35, nombreEspaldaFontSize * factorReduccion); // Mínimo 35px
            console.log(`📐 [AJUSTE NOMBRE] "${nombreTexto}" (${nombreTexto.length} letras) | Fuente ajustada: ${Math.round(nombreEspaldaFontSize)}px | Ancho estimado: ${Math.round(nombreEspaldaFontSize * nombreTexto.length * 0.75)}px / ${Math.round(anchoMaximoNombre)}px`);
          }

          const nombreEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: nombreEspaldaX,
              y: nombreEspaldaY,
            },
            dimensions: { width: 120, height: 30 },
            rotation: 0,
            zIndex: currentElements.length + 1000, // zIndex alto para estar al frente
            locked: false,
            visible: true,
            content: nombreTexto,
            fontFamily: fonteFila,
            fontSize: nombreEspaldaFontSize,
            fontColor: colorNombreEspalda,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(nombreEspaldaText);
          addElement(nombreEspaldaText, currentPageIndex);
        }

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
          source: 'excel',
        };

        currentElements.push(newShortLeft);
        addElement(newShortLeft, currentPageIndex);

        // --- CREAR SHORT DERECHO (columna 2, abajo, invertido 180°) ---
        const shortRightPos = {
          x: jerseyDimensions.width + elementGap,
          y: finalUniformY + shortsDimensions.height + elementGap
        };

        // Log de debugging para calcular offsets
        console.log(`🩳 [SHORT DERECHO] Talla: ${tallaMostrar} | Pos base: (x: ${Math.round(shortRightPos.x)}, y: ${Math.round(shortRightPos.y)})`);

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
          source: 'excel',
        };

        currentElements.push(newShortRight);
        addElement(newShortRight, currentPageIndex);

        // Número en el short derecho (posicionado según imagen de referencia: 70% ancho, 55% alto)
        // Ajustado: -40cm izquierda, -13cm arriba (considerando rotación 180°)
        // Solo se agrega si tamano_numero_short tiene un valor
        if (row.numero && row.tamano_numero_short) {
          // Usar posición configurada o calcular
          let numeroShortX, numeroShortY, numeroShortFontSize;

          if (textPosConfig) {
            // Usar offsets relativos a la posición del short derecho
            numeroShortX = shortRightPos.x + textPosConfig.shortsRight.offsetX;
            numeroShortY = shortRightPos.y + textPosConfig.shortsRight.offsetY;
            numeroShortFontSize = textPosConfig.shortsRight.fontSize;
          } else {
            // Posición calculada (código original)
            numeroShortX = shortRightPos.x + shortsDimensions.width * 0.70 - 300 + 30;
            numeroShortY = shortRightPos.y + shortsDimensions.height * 0.55 - 90 + 50;
            numeroShortFontSize = tamanoNumeroShort;
          }

          const numeroShortRightText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "shorts",
            size: tallaMostrar as any,
            position: {
              x: numeroShortX,
              y: numeroShortY,
            },
            dimensions: { width: 40, height: 30 },
            rotation: 180, // Rotado 180° como el short
            zIndex: currentElements.length + 1000, // zIndex alto para estar al frente
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: numeroShortFontSize,
            fontColor: colorNumeroShort,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(numeroShortRightText);
          addElement(numeroShortRightText, currentPageIndex);
        }

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
          console.log(`🆕 [Layout Opción A] Creando nueva página. Uniforme: ${row.nombre}, Talla: ${tallaMostrar}`);
          addPage();
          currentPageIndex++;
          // Sincronizar currentElements con el estado real de la nueva página
          const { pages: updatedPages } = useDesignerStore.getState();
          console.log(`   Total páginas: ${updatedPages.length}, currentPageIndex: ${currentPageIndex}`);
          currentElements = updatedPages[currentPageIndex] ? [...updatedPages[currentPageIndex]] : [];
          console.log(`   Elementos en nueva página: ${currentElements.length}`);
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
          imageUrl: getMoldeFrenteUrl(tallaExcel, genero),
          source: 'excel',
        };

        currentElements.push(newJerseyFrente);
        addElement(newJerseyFrente, currentPageIndex);

        // Número en el frente (pecho derecho, 10cm más arriba, ajustado según dígitos)
        if (row.numero) {
          // Ajustar posición según cantidad de dígitos
          const numeroStr = String(row.numero);
          const cantidadDigitos = numeroStr.length;
          const ajusteDigitos = cantidadDigitos === 1 ? 20 : -20; // 1 dígito: +2cm, 2+ dígitos: -2cm

          const numeroFrenteText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyFrentePos.x + jerseyDimensions.width * 0.75 - 85 + ajusteDigitos,
              y: jerseyFrentePos.y + jerseyDimensions.height * 0.30 - 100,
            },
            dimensions: { width: 30, height: 25 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: tamanoNumeroFrente,
            fontColor: colorNumeroFrente,
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
          imageUrl: getMoldeEspaldaUrl(tallaExcel, genero),
          source: 'excel',
        };

        currentElements.push(newJerseyEspalda);
        addElement(newJerseyEspalda, currentPageIndex);

        // Número trasero (10cm a la izquierda)
        if (row.numero) {
          const numeroEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 130,
              y: jerseyEspaldaPos.y + jerseyDimensions.height * 0.35,
            },
            dimensions: { width: 60, height: 40 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: tamanoNumeroEspalda,
            fontColor: colorNumeroEspalda,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(numeroEspaldaText);
          addElement(numeroEspaldaText, currentPageIndex);
        }

        // Nombre en la espalda (13cm abajo desde la parte superior, 6cm a la izquierda)
        if (row.nombre) {
          const nombreEspaldaText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: {
              x: jerseyEspaldaPos.x + jerseyDimensions.width / 2 - 120,
              y: jerseyEspaldaPos.y + 130,
            },
            dimensions: { width: 120, height: 30 },
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.nombre).toUpperCase(),
            fontFamily: fonteFila,
            fontSize: tamanoNombreEspalda,
            fontColor: colorNombreEspalda,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "back",
          };

          currentElements.push(nombreEspaldaText);
          addElement(nombreEspaldaText, currentPageIndex);
        }

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
          source: 'excel',
        };

        currentElements.push(newShortLeft);
        addElement(newShortLeft, currentPageIndex);

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
          source: 'excel',
        };

        currentElements.push(newShortRight);
        addElement(newShortRight, currentPageIndex);

        // Número en el short derecho (posicionado según imagen de referencia: 70% ancho, 55% alto)
        // Ajustado: -40cm izquierda, -13cm arriba (considerando rotación 180°)
        // Solo se agrega si tamano_numero_short tiene un valor
        if (row.numero && row.tamano_numero_short) {
          const numeroShortRightText: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "shorts",
            size: tallaMostrar as any,
            position: {
              x: shortRightPos.x + shortsDimensions.width * 0.70 - 300 + 30, // +3cm a la derecha
              y: shortRightPos.y + shortsDimensions.height * 0.55 - 90 + 50, // +5cm hacia abajo
            },
            dimensions: { width: 40, height: 30 },
            rotation: 180, // Rotado 180° como el short
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero),
            fontFamily: fonteFila,
            fontSize: tamanoNumeroShort,
            fontColor: colorNumeroShort,
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(numeroShortRightText);
          addElement(numeroShortRightText, currentPageIndex);
        }
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
