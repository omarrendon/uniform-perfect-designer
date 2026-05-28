import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish, Size, UniformTemplate, TextElement, CanvasElement } from "../types";
import { readExcelFile } from "./excelReader";
import { generateId, base64ToBlobUrl } from "./canvas";
import { compressImageForCanvas } from "./imageCompressorForCanvas";
import { loadFont } from "./fontLoader";
import { optimizeLayoutAdvanced } from "./binPacking";

export interface ExcelProcessorCallbacks {
  onError: (title: string, message: string, details?: string[]) => void;
  onProgress: (current: number, total: number) => void;
  onStart: () => void;
  onComplete: (summary: { totalElements: number; pagesUsed: number }) => void;
}

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
  'XS': {
    jerseyFront: {
      offsetX: 296,      // Offset desde jerseyFrentePos (estimado)
      offsetY: 107,
      fontSize: 105.14
    },
    jerseyBackNumber: {
      offsetX: 128,      // Offset desde jerseyEspaldaPos (estimado)
      offsetY: 198,      // Estimado basado en patrón de M
      fontSize: 286.28
    },
    jerseyBackName: {
      offsetX: 164,      // Offset desde jerseyEspaldaPos (estimado)
      offsetY: 130,      // Estimado basado en patrón de M
      fontSize: 81.98
    },
    shortsRight: {
      offsetX: 307,      // 337 - 30 (ajustado 30px a la izquierda)
      offsetY: 278,      // 293 - 15 (ajustado 15px más arriba)
      fontSize: 134.34
    }
  },
  'S': {
    jerseyFront: {
      offsetX: 312,      // Offset desde jerseyFrentePos (estimado)
      offsetY: 113,
      fontSize: 107.99
    },
    jerseyBackNumber: {
      offsetX: 145,      // Offset desde jerseyEspaldaPos (actualizado)
      offsetY: 222,      // Estimado basado en nuevas coordenadas
      fontSize: 283.43
    },
    jerseyBackName: {
      offsetX: 163,      // Offset desde jerseyEspaldaPos (actualizado)
      offsetY: 136,      // Estimado basado en nuevas coordenadas (884 - 748)
      fontSize: 86.52
    },
    shortsRight: {
      offsetX: 305,      // Actualizado basado en nuevas coordenadas (873 - ~568)
      offsetY: 280,      // Actualizado basado en nuevas coordenadas (870 - ~590)
      fontSize: 145.73
    }
  },
  'M': {
    jerseyFront: {
      offsetX: 330,      // Offset desde jerseyFrentePos
      offsetY: 116,
      fontSize: 116.76
    },
    jerseyBackNumber: {
      offsetX: 148,      // Offset desde jerseyEspaldaPos
      offsetY: 204,
      fontSize: 319.02
    },
    jerseyBackName: {
      offsetX: 189,      // Offset desde jerseyEspaldaPos
      offsetY: 130,
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
      offsetX: 351,      // Offset desde jerseyFrentePos (estimado)
      offsetY: 128,
      fontSize: 119.38
    },
    jerseyBackNumber: {
      offsetX: 160,      // Offset desde jerseyEspaldaPos (estimado)
      offsetY: 225,      // Estimado basado en patrón
      fontSize: 311.90
    },
    jerseyBackName: {
      offsetX: 196,      // Offset desde jerseyEspaldaPos (estimado)
      offsetY: 131,      // Estimado basado en patrón
      fontSize: 88.02
    },
    shortsRight: {
      offsetX: 307,      // Usando patrón similar a otras tallas
      offsetY: 278,      // Usando patrón similar a otras tallas
      fontSize: 147.05
    }
  },
  'XL': {
    jerseyFront: {
      offsetX: 357,      // Offset desde jerseyFrentePos (x: 0)
      offsetY: 137,
      fontSize: 121.64
    },
    jerseyBackNumber: {
      offsetX: 137,      // Offset desde jerseyEspaldaPos (x: 634) → 771 - 634 = 137
      offsetY: 246,      // Offset desde jerseyEspaldaPos (y: 0) → 246 - 0 = 246
      fontSize: 330.79
    },
    jerseyBackName: {
      offsetX: 211,      // Offset desde jerseyEspaldaPos (x: 634) → 845 - 634 = 211
      offsetY: 149,      // Offset desde jerseyEspaldaPos (y: 0) → 149 - 0 = 149
      fontSize: 98.06
    },
    shortsRight: {
      offsetX: 389,      // Offset desde shortRightPos (x: 0) → 389 - 0 = 389
      offsetY: 332,      // Offset desde shortRightPos (y: 1550) → 1882 - 1550 = 332
      fontSize: 161.13
    }
  },
  // Todas las tallas principales están configuradas
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
      addElementsBatch
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
    };

    // Mapeo de género Excel a tipo Gender
    const excelToGender = (generoExcel: unknown): 'Hombre' | 'Mujer' => {
      if (generoExcel == null || generoExcel === '') return 'Hombre';
      const generoLower = String(generoExcel).toLowerCase().trim();
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

    // VALIDACIÓN: Verificar que el template del uniforme esté completamente configurado
    const { isTemplateComplete, uniformTemplate } = useDesignerStore.getState();

    // Detectar si el template es SVG (aplica a todos los elementos creados desde este template)
    const isSvgTemplate = uniformTemplate?.jerseyFront?.startsWith('data:image/svg+xml') ?? false;

    if (!isTemplateComplete()) {
      const faltantes: string[] = [];
      if (!uniformTemplate?.jerseyFront) faltantes.push('Playera Delantera');
      if (!uniformTemplate?.jerseyBack)  faltantes.push('Playera Trasera');
      if (!uniformTemplate?.shortsLeft)  faltantes.push('Short Izquierdo');
      if (!uniformTemplate?.shortsRight) faltantes.push('Short Derecho');

      onError(
        "Plantilla no configurada",
        "Debes cargar la plantilla del uniforme antes de procesar el Excel. Las 4 imágenes son obligatorias.",
        faltantes.map(f => `✗ Falta: ${f}`)
      );
      return;
    }

    // Blob URLs por pieza y por talla — declarados aquí para que las funciones helper
    // puedan capturarlos por referencia; se populan antes del loop principal.
    const templateBlobUrls: Record<string, string> = {};
    const sizeBlobUrls: Record<string, Record<string, string>> = {};

    // Funciones auxiliares para obtener moldes (con género)
    const getMoldeFrenteUrl = (tallaExcel: string, genero: 'Hombre' | 'Mujer'): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return templateBlobUrls['jerseyFront'] ?? "";

      const sizeKey = createSizeKey(genero, tallaSpanish);
      return sizeBlobUrls[sizeKey]?.['jerseyFront'] ?? templateBlobUrls['jerseyFront'] ?? "";
    };

    const getMoldeEspaldaUrl = (tallaExcel: string, genero: 'Hombre' | 'Mujer'): string => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return templateBlobUrls['jerseyBack'] ?? "";

      const sizeKey = createSizeKey(genero, tallaSpanish);
      return sizeBlobUrls[sizeKey]?.['jerseyBack'] ?? templateBlobUrls['jerseyBack'] ?? "";
    };

    const getShortsConfig = (tallaExcel: string, genero: 'Hombre' | 'Mujer'): {
      left: { url: string };
      right: { url: string };
    } => {
      const talla = tallaExcel.toLowerCase().trim();
      const tallaSpanish = excelToSpanish[talla];
      if (!tallaSpanish) return { left: { url: "" }, right: { url: "" } };

      const sizeKey = createSizeKey(genero, tallaSpanish);
      return {
        left: { url: sizeBlobUrls[sizeKey]?.['shortsLeft'] ?? templateBlobUrls['shortsLeft'] ?? "" },
        right: { url: sizeBlobUrls[sizeKey]?.['shortsRight'] ?? templateBlobUrls['shortsRight'] ?? "" },
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

    // Yield al event loop para que el loading se muestre
    await new Promise(resolve => setTimeout(resolve, 0));

    const uniformSizesConfigOriginal = useDesignerStore.getState().uniformSizesConfig;

    // Comprimir imágenes para el canvas (todas las tallas en paralelo)
    const compressedConfig: any = {};
    await Promise.all(
      Object.entries(uniformSizesConfigOriginal).map(async ([sizeKey, images]) => {
        if (!images) return;
        compressedConfig[sizeKey] = {};
        const pieces = ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight'] as const;
        await Promise.all(
          pieces.map(async (piece) => {
            if (images[piece]) {
              compressedConfig[sizeKey][piece] = await compressImageForCanvas(images[piece]!);
            }
          })
        );
      })
    );

    useDesignerStore.setState({ uniformSizesConfigCompressed: compressedConfig });

    // Comprimir uniformTemplate para canvas (una sola vez para todas las tallas)
    const { uniformTemplate: tmpl } = useDesignerStore.getState();
    if (tmpl) {
      const compressedTemplate: Record<string, string> = {};
      const pieces = ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight'] as const;
      await Promise.all(
        pieces.map(async (piece) => {
          if (tmpl[piece]) {
            compressedTemplate[piece] = await compressImageForCanvas(tmpl[piece]!);
          }
        })
      );
      useDesignerStore.setState({ uniformTemplateCompressed: compressedTemplate });
    }

    // Staging para MaxRects
    const stagedUniforms: UniformTemplate[] = [];
    const stagedTexts: Array<{ element: TextElement; parentId: string }> = [];

    // Poblar blob URLs desde las imágenes ya comprimidas
    const { uniformTemplateCompressed, uniformSizesConfigCompressed } = useDesignerStore.getState();
    for (const piece of ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight'] as const) {
      const base64 = uniformTemplateCompressed?.[piece];
      if (base64) templateBlobUrls[piece] = base64ToBlobUrl(base64);
    }
    for (const [sizeKey, images] of Object.entries(uniformSizesConfigCompressed ?? {})) {
      sizeBlobUrls[sizeKey] = {};
      for (const piece of ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight'] as const) {
        const base64 = images?.[piece];
        if (base64) sizeBlobUrls[sizeKey][piece] = base64ToBlobUrl(base64);
      }
    }

    // Procesar filas del Excel
    let processedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.nombre || row.nombre.trim() === "") {
        continue;
      }

      processedCount++;

      const tallaExcel = String(row.talla ?? "m");
      const genero = excelToGender(row.genero);
      const sizeConfig = getSizeConfig(tallaExcel, genero);
      const tallaMostrar = tallaExcel.toUpperCase().trim();

      const tallaMapping: { [key: string]: Size } = {
        'XCH': 'XS', 'CH': 'S', 'M': 'M',
        'G': 'L', 'XG': 'XL',
        'XS': 'XS', 'S': 'S', 'L': 'L',
        'XL': 'XL',
      };
      const tallaMapeada = tallaMapping[tallaMostrar] || tallaMostrar;

      const designConfig = useDesignerStore.getState().uniformDesignConfig;
      const designFont = designConfig?.jerseyFrontNumber?.fontFamily ?? 'Arial';
      if (designFont !== 'Arial') {
        await loadFont(designFont);
      }

      const jerseyDimensions = {
        width: sizeConfig.width,
        height: sizeConfig.height,
      };

      const shortsConfig = getShortsConfig(tallaExcel, genero);
      const shortsDimensions = {
        width: sizeConfig.shortsWidth || sizeConfig.width * 0.45,
        height: sizeConfig.shortsHeight || sizeConfig.height * 0.76,
      };

      const textPosConfig = getTextPositionConfig(tallaMapeada);
      const M_JERSEY_W_REF = 568.63;
      const M_SHORTS_W_REF = 863.6;
      const jerseyScale = jerseyDimensions.width / M_JERSEY_W_REF;
      const shortsScale = shortsDimensions.width / M_SHORTS_W_REF;

      const elementCount = stagedUniforms.length + stagedTexts.length;

      // --- JERSEY FRENTE ---
      const jerseyFrenteId = generateId("uniform");
      const newJerseyFrente: UniformTemplate = {
        id: jerseyFrenteId,
        type: "uniform",
        part: "jersey",
        size: tallaMostrar as any,
        position: { x: 0, y: 0 },
        dimensions: jerseyDimensions,
        rotation: 0,
        zIndex: elementCount,
        locked: false,
        visible: true,
        baseColor: "#ffffff",
        imageUrl: getMoldeFrenteUrl(tallaExcel, genero),
        templatePiece: 'jerseyFront',
        source: 'excel',
        isSvg: isSvgTemplate,
      };
      stagedUniforms.push(newJerseyFrente);

      if (row.numero) {
        let offsetX: number, offsetY: number, fontSize: number;

        if (designConfig?.jerseyFrontNumber) {
          const cfg = designConfig.jerseyFrontNumber;
          offsetX = cfg.relativeX * jerseyDimensions.width;
          offsetY = cfg.relativeY * jerseyDimensions.height;
          fontSize = cfg.fontSize * jerseyScale;
        } else if (textPosConfig) {
          offsetX = textPosConfig.jerseyFront.offsetX;
          offsetY = textPosConfig.jerseyFront.offsetY;
          fontSize = textPosConfig.jerseyFront.fontSize;
        } else {
          const cantidadDigitos = String(row.numero).length;
          const ajusteDigitos = cantidadDigitos === 1 ? 20 : -20;
          offsetX = jerseyDimensions.width * 0.75 - 85 + ajusteDigitos;
          offsetY = jerseyDimensions.height * 0.30 - 100;
          fontSize = 24;
        }

        const numeroFrenteText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: { x: offsetX, y: offsetY },
          dimensions: { width: 30, height: 25 },
          rotation: 0,
          zIndex: elementCount + 1000,
          locked: false,
          visible: true,
          content: String(row.numero),
          fontFamily: designConfig?.jerseyFrontNumber?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.jerseyFrontNumber?.fontColor ?? '#000000',
          textAlign: designConfig?.jerseyFrontNumber?.textAlign ?? "center",
          fontWeight: designConfig?.jerseyFrontNumber?.fontWeight ?? "bold",
          opacity: 1,
          side: "front",
        };
        stagedTexts.push({ element: numeroFrenteText, parentId: jerseyFrenteId });
      }

      // --- JERSEY ESPALDA ---
      const jerseyEspaldaId = generateId("uniform");
      const newJerseyEspalda: UniformTemplate = {
        id: jerseyEspaldaId,
        type: "uniform",
        part: "jersey",
        size: tallaMostrar as any,
        position: { x: 0, y: 0 },
        dimensions: jerseyDimensions,
        rotation: 0,
        zIndex: elementCount + 1,
        locked: false,
        visible: true,
        baseColor: "#ffffff",
        imageUrl: getMoldeEspaldaUrl(tallaExcel, genero),
        templatePiece: 'jerseyBack',
        source: 'excel',
        isSvg: isSvgTemplate,
      };
      stagedUniforms.push(newJerseyEspalda);

      if (row.numero) {
        let offsetX: number, offsetY: number, fontSize: number;

        if (designConfig?.jerseyBackNumber) {
          const cfg = designConfig.jerseyBackNumber;
          offsetX = cfg.relativeX * jerseyDimensions.width;
          offsetY = cfg.relativeY * jerseyDimensions.height;
          fontSize = cfg.fontSize * jerseyScale;
        } else if (textPosConfig) {
          offsetX = textPosConfig.jerseyBackNumber.offsetX;
          offsetY = textPosConfig.jerseyBackNumber.offsetY;
          fontSize = textPosConfig.jerseyBackNumber.fontSize;
        } else {
          offsetX = jerseyDimensions.width / 2 - 130;
          offsetY = jerseyDimensions.height * 0.35;
          fontSize = 40;
        }

        const numeroEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: { x: offsetX, y: offsetY },
          dimensions: { width: 60, height: 40 },
          rotation: 0,
          zIndex: elementCount + 1000,
          locked: false,
          visible: true,
          content: String(row.numero),
          fontFamily: designConfig?.jerseyBackNumber?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.jerseyBackNumber?.fontColor ?? '#000000',
          textAlign: designConfig?.jerseyBackNumber?.textAlign ?? "center",
          fontWeight: designConfig?.jerseyBackNumber?.fontWeight ?? "bold",
          opacity: 1,
          side: "back",
        };
        stagedTexts.push({ element: numeroEspaldaText, parentId: jerseyEspaldaId });
      }

      if (row.nombre) {
        let offsetX: number, offsetY: number, fontSize: number;
        const nombreTexto = String(row.nombre).toUpperCase();

        if (designConfig?.jerseyBackName) {
          const cfg = designConfig.jerseyBackName;
          offsetX = cfg.relativeX * jerseyDimensions.width;
          offsetY = cfg.relativeY * jerseyDimensions.height;
          fontSize = cfg.fontSize * jerseyScale;
        } else if (textPosConfig) {
          offsetX = textPosConfig.jerseyBackName.offsetX;
          offsetY = textPosConfig.jerseyBackName.offsetY;
          fontSize = textPosConfig.jerseyBackName.fontSize;

          if (nombreTexto.length > 5) {
            let desplazamientoIzquierda = 0;
            let desplazamientoAbajo = 0;
            if (nombreTexto.length >= 6 && nombreTexto.length <= 7) {
              desplazamientoIzquierda = 40;
            } else if (nombreTexto.length >= 8) {
              desplazamientoIzquierda = 45;
              desplazamientoAbajo = 15;
            }
            offsetX -= desplazamientoIzquierda;
            offsetY += desplazamientoAbajo;
          }
        } else {
          offsetX = jerseyDimensions.width / 2 - 120;
          offsetY = 130;
          fontSize = 16;
        }

        const anchoMaximoNombre = jerseyDimensions.width * 0.75;
        const anchoAproximadoTexto = fontSize * nombreTexto.length * 0.75;
        if (anchoAproximadoTexto > anchoMaximoNombre) {
          const factorReduccion = anchoMaximoNombre / anchoAproximadoTexto;
          fontSize = Math.max(35, fontSize * factorReduccion);
        }

        const nombreEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: { x: offsetX, y: offsetY },
          dimensions: { width: 120, height: 30 },
          rotation: 0,
          zIndex: elementCount + 1000,
          locked: false,
          visible: true,
          content: nombreTexto,
          fontFamily: designConfig?.jerseyBackName?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.jerseyBackName?.fontColor ?? '#000000',
          textAlign: designConfig?.jerseyBackName?.textAlign ?? "center",
          fontWeight: designConfig?.jerseyBackName?.fontWeight ?? "bold",
          opacity: 1,
          side: "back",
        };
        stagedTexts.push({ element: nombreEspaldaText, parentId: jerseyEspaldaId });
      }

      // --- SHORT IZQUIERDO ---
      const shortsLeftId = generateId("uniform");
      const newShortLeft: UniformTemplate = {
        id: shortsLeftId,
        type: "uniform",
        part: "shorts",
        size: tallaMostrar as any,
        position: { x: 0, y: 0 },
        dimensions: shortsDimensions,
        rotation: 0,
        zIndex: elementCount + 2,
        locked: false,
        visible: true,
        baseColor: "#ffffff",
        imageUrl: shortsConfig.left.url,
        templatePiece: 'shortsLeft',
        side: "left",
        source: 'excel',
        isSvg: isSvgTemplate,
      };
      stagedUniforms.push(newShortLeft);

      // --- SHORT DERECHO ---
      const shortsRightId = generateId("uniform");
      const newShortRight: UniformTemplate = {
        id: shortsRightId,
        type: "uniform",
        part: "shorts",
        size: tallaMostrar as any,
        position: { x: 0, y: 0 },
        dimensions: shortsDimensions,
        rotation: 180,
        zIndex: elementCount + 3,
        locked: false,
        visible: true,
        baseColor: "#ffffff",
        imageUrl: shortsConfig.right.url,
        templatePiece: 'shortsRight',
        side: "right",
        source: 'excel',
        isSvg: isSvgTemplate,
      };
      stagedUniforms.push(newShortRight);

      if (row.numero && (row.tamano_numero_short || designConfig?.shortsNumber?.enabled)) {
        let offsetX: number, offsetY: number, fontSize: number;
        let shortParentId = shortsRightId;

        if (designConfig?.shortsNumber) {
          const cfg = designConfig.shortsNumber;
          const isLeft = (cfg as any).side === 'left';
          shortParentId = isLeft ? shortsLeftId : shortsRightId;
          offsetX = cfg.relativeX * shortsDimensions.width;
          offsetY = cfg.relativeY * shortsDimensions.height;
          fontSize = cfg.fontSize * shortsScale;
        } else if (textPosConfig) {
          offsetX = textPosConfig.shortsRight.offsetX;
          offsetY = textPosConfig.shortsRight.offsetY;
          fontSize = textPosConfig.shortsRight.fontSize;
        } else {
          offsetX = shortsDimensions.width * 0.70 - 300 + 30;
          offsetY = shortsDimensions.height * 0.55 - 90 + 50;
          fontSize = 24;
        }

        const numeroShortRightText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "shorts",
          size: tallaMostrar as any,
          position: { x: offsetX, y: offsetY },
          dimensions: { width: 40, height: 30 },
          rotation: 0,
          zIndex: elementCount + 2000,
          locked: false,
          visible: true,
          content: String(row.numero),
          fontFamily: designConfig?.shortsNumber?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.shortsNumber?.fontColor ?? '#000000',
          textAlign: designConfig?.shortsNumber?.textAlign ?? "center",
          fontWeight: designConfig?.shortsNumber?.fontWeight ?? "bold",
          opacity: 1,
          side: "front",
        };
        stagedTexts.push({ element: numeroShortRightText, parentId: shortParentId });
      }

      onProgress(processedCount, rows.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // --- POST-PROCESO: MaxRects asigna posiciones óptimas ---
    const result = optimizeLayoutAdvanced(stagedUniforms, canvasConfig, {
      elementGap: 5,
      canvasMargin: 0,
      canvasMarginV: 0,
      allowRotation: false,
      sortStrategy: 'area',
      heuristic: 'BSSF',
    });

    // Crear páginas adicionales si son necesarias
    const { pages: existingPages } = useDesignerStore.getState();
    for (let i = existingPages.length; i < result.pagesUsed; i++) {
      addPage();
    }

    // Construir mapas de posición/página y acumular todos los elementos por página
    const uniformPageMap = new Map<string, number>();
    const uniformPositionMap = new Map<string, { x: number; y: number }>();
    const uniformElementMap = new Map<string, UniformTemplate>();
    const batchMap = new Map<number, CanvasElement[]>();

    result.pages.forEach((pageEls, pageIndex) => {
      const pageItems: CanvasElement[] = [];
      pageEls.forEach(el => {
        const uniformEl = el as UniformTemplate;
        pageItems.push(uniformEl);
        uniformPageMap.set(uniformEl.id, pageIndex);
        uniformPositionMap.set(uniformEl.id, uniformEl.position);
        uniformElementMap.set(uniformEl.id, uniformEl);
      });
      batchMap.set(pageIndex, pageItems);
    });

    // Agregar textos con posición absoluta = posición del padre + offset relativo
    for (const { element, parentId } of stagedTexts) {
      const parentPos = uniformPositionMap.get(parentId);
      const pageIndex = uniformPageMap.get(parentId);
      const parentUniform = uniformElementMap.get(parentId);
      if (parentPos === undefined || pageIndex === undefined || !parentUniform) continue;

      let localX = element.position.x;
      let localY = element.position.y;
      let finalRotation = element.rotation;

      // Replicar posicionamiento de un texto dentro de un uniforme rotado (p.ej. short derecho a 180°).
      if (parentUniform.rotation !== 0) {
        const centerX = parentUniform.dimensions.width / 2;
        const centerY = parentUniform.dimensions.height / 2;
        const relX = localX - centerX;
        const relY = localY - centerY;
        const angleRad = (parentUniform.rotation * Math.PI) / 180;

        const rotatedRelX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad);
        const rotatedRelY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad);

        localX = centerX + rotatedRelX;
        localY = centerY + rotatedRelY;
        finalRotation = (finalRotation + parentUniform.rotation) % 360;
      }

      const absElement = {
        ...element,
        position: {
          x: parentPos.x + localX,
          y: parentPos.y + localY,
        },
        rotation: finalRotation,
      } as TextElement;
      const page = batchMap.get(pageIndex) ?? [];
      page.push(absElement);
      batchMap.set(pageIndex, page);
    }

    // Un solo set() de Zustand → un solo re-render del canvas
    addElementsBatch(batchMap);

    // Mostrar canvas
    setCanvasHidden(false);

    // Completar
    onComplete({
      totalElements: stagedUniforms.length + stagedTexts.length,
      pagesUsed: result.pagesUsed,
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
