import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish, Size, UniformTemplate, TextElement, CanvasElement } from "../types";
import { readExcelFile } from "./excelReader";
import { generateId, base64ToBlobUrl } from "./canvas";
import { compressImageForCanvas } from "./imageCompressorForCanvas";
import { loadFont } from "./fontLoader";
import { optimizeLayoutAdvanced } from "./binPacking";
import { generateBitmapMask, type BitmapMask } from "./svgBitmap";

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

// Offsets escalados proporcionalmente desde las medidas anteriores a las medidas
// oficiales de TABLA-TALLAS.xlsx (jun 2026). XS eliminado — tallas disponibles: S, M, L, XL.
const TEXT_POSITIONS_BY_SIZE: Record<string, SizeTextConfig> = {
  'S': {
    jerseyFront:      { offsetX: 309, offsetY: 112, fontSize: 106.95 },
    jerseyBackNumber: { offsetX: 144, offsetY: 219, fontSize: 280.70 },
    jerseyBackName:   { offsetX: 162, offsetY: 134, fontSize:  85.69 },
    shortsRight:      { offsetX: 267, offsetY: 256, fontSize: 127.79 },
  },
  'M': {
    jerseyFront:      { offsetX: 324, offsetY: 114, fontSize: 114.79 },
    jerseyBackNumber: { offsetX: 146, offsetY: 200, fontSize: 313.63 },
    jerseyBackName:   { offsetX: 186, offsetY: 127, fontSize:  93.00 },
    shortsRight:      { offsetX: 293, offsetY: 280, fontSize: 130.98 },
  },
  'L': {
    jerseyFront:      { offsetX: 341, offsetY: 124, fontSize: 115.99 },
    jerseyBackNumber: { offsetX: 156, offsetY: 218, fontSize: 303.04 },
    jerseyBackName:   { offsetX: 190, offsetY: 127, fontSize:  85.52 },
    shortsRight:      { offsetX: 265, offsetY: 250, fontSize: 127.02 },
  },
  'XL': {
    jerseyFront:      { offsetX: 344, offsetY: 132, fontSize: 117.08 },
    jerseyBackNumber: { offsetX: 132, offsetY: 236, fontSize: 318.38 },
    jerseyBackName:   { offsetX: 203, offsetY: 143, fontSize:  94.38 },
    shortsRight:      { offsetX: 333, offsetY: 296, fontSize: 137.89 },
  },
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

    // Obtener funciones del store
    const {
      canvasConfig,
      addPage,
      sizeConfigs,
      setCanvasHidden,
      addElementsBatch
    } = useDesignerStore.getState();

    // Mapeo de tallas Excel a tallas en español (XS/XCH ya no disponibles → CH/S)
    const excelToSpanish: Record<string, SizeSpanish> = {
      'xs': 'CH',
      'xch': 'CH',
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

    // VALIDACIÓN: Verificar que al menos un par completo esté configurado
    const { isTemplateComplete, uniformTemplate } = useDesignerStore.getState();

    const hasJerseys = !!(uniformTemplate?.jerseyFront && uniformTemplate?.jerseyBack);
    const hasShorts  = !!(uniformTemplate?.shortsLeft  && uniformTemplate?.shortsRight);

    if (!isTemplateComplete()) {
      const faltantes: string[] = [];
      if (!uniformTemplate?.jerseyFront) faltantes.push('Playera Delantera');
      if (!uniformTemplate?.jerseyBack)  faltantes.push('Playera Trasera');
      if (!uniformTemplate?.shortsLeft)  faltantes.push('Short Izquierdo');
      if (!uniformTemplate?.shortsRight) faltantes.push('Short Derecho');

      onError(
        "Plantilla no configurada",
        "Debes cargar al menos las 2 playeras o los 2 shorts para continuar.",
        faltantes.map(f => `✗ Falta: ${f}`)
      );
      return;
    }

    // Detectar si el template es SVG
    const isSvgTemplate = uniformTemplate?.jerseyFront?.startsWith('data:image/svg+xml')
      ?? uniformTemplate?.shortsLeft?.startsWith('data:image/svg+xml')
      ?? false;

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

      // Mapeo de tallas en español a inglés (XS/XCH → S por eliminación de XS)
      const tallaMapping: { [key: string]: Size } = {
        // Español
        'XCH': 'S',
        'CH': 'S',
        'M': 'M',
        'G': 'L',
        'XG': 'XL',
        '2XG': 'XL',
        '3XG': 'XL',
        // Inglés (también soportado)
        'XS': 'S',
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
    // Incluye piezas opcionales (sleeveLeft, sleeveRight, collar) si están cargadas.
    const { uniformTemplate: tmpl } = useDesignerStore.getState();
    if (tmpl) {
      const compressedTemplate: Record<string, string> = {};
      const pieces = ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight',
                      'sleeveLeft', 'sleeveRight', 'collar'] as const;
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

    // Poblar blob URLs desde las imágenes ya comprimidas (base + opcionales)
    const { uniformTemplateCompressed, uniformSizesConfigCompressed } = useDesignerStore.getState();
    for (const piece of ['jerseyFront', 'jerseyBack', 'shortsLeft', 'shortsRight',
                         'sleeveLeft', 'sleeveRight', 'collar'] as const) {
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
        'XCH': 'S', 'CH': 'S', 'M': 'M',
        'G': 'L', 'XG': 'XL',
        'XS': 'S', 'S': 'S', 'L': 'L',
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
      const M_JERSEY_W_REF = 559.04; // ancho M Hombre según TABLA-TALLAS.xlsx jun 2026
      const M_SHORTS_W_REF = 751.83; // ancho shorts M Hombre según TABLA-TALLAS.xlsx jun 2026
      const jerseyScale = jerseyDimensions.width / M_JERSEY_W_REF;
      const shortsScale = shortsDimensions.width / M_SHORTS_W_REF;

      const elementCount = stagedUniforms.length + stagedTexts.length;

      // --- JERSEY FRENTE ---
      if (hasJerseys) {
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
          fontColorCmyk: designConfig?.jerseyFrontNumber?.fontColorCmyk,
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
        let offsetY: number, fontSize: number;

        if (designConfig?.jerseyBackNumber) {
          const cfg = designConfig.jerseyBackNumber;
          offsetY = cfg.relativeY * jerseyDimensions.height;
          fontSize = cfg.fontSize * jerseyScale;
        } else if (textPosConfig) {
          offsetY = textPosConfig.jerseyBackNumber.offsetY;
          fontSize = textPosConfig.jerseyBackNumber.fontSize;
        } else {
          offsetY = jerseyDimensions.height * 0.35;
          fontSize = 40;
        }

        // El número siempre se centra horizontalmente usando el ancho completo del jersey
        // (dimensions.width > 450 → TextElement.tsx activa textAlign='center' en Konva).
        // Así "1" y "10" quedan centrados igual, sin depender del ancho de los glifos.
        const numeroEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: { x: 0, y: offsetY },
          dimensions: { width: jerseyDimensions.width, height: Math.ceil(fontSize * 1.2) },
          rotation: 0,
          zIndex: elementCount + 1000,
          locked: false,
          visible: true,
          content: String(row.numero),
          fontFamily: designConfig?.jerseyBackNumber?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.jerseyBackNumber?.fontColor ?? '#000000',
          fontColorCmyk: designConfig?.jerseyBackNumber?.fontColorCmyk,
          textAlign: 'center',
          fontWeight: designConfig?.jerseyBackNumber?.fontWeight ?? "bold",
          opacity: 1,
          side: "back",
        };
        stagedTexts.push({ element: numeroEspaldaText, parentId: jerseyEspaldaId });
      }

      if (row.nombre) {
        let offsetX: number, offsetY: number, fontSize: number;
        const nombreTexto = String(row.nombre).toUpperCase();

        const _charW = 0.70;
        const _targetW = jerseyDimensions.width * 0.70;
        const _maxFs = jerseyDimensions.height * 0.11;
        const _minFs = jerseyDimensions.width * 0.04;

        if (designConfig?.jerseyBackName) {
          const cfg = designConfig.jerseyBackName;
          offsetX = cfg.relativeX * jerseyDimensions.width;
          offsetY = cfg.relativeY * jerseyDimensions.height;
          const configFs = cfg.fontSize * jerseyScale;
          const fitFs = _targetW / (nombreTexto.length * _charW);
          fontSize = Math.max(_minFs, Math.min(_maxFs, configFs, fitFs));
        } else {
          offsetX = textPosConfig?.jerseyBackName.offsetX ?? 0;
          offsetY = textPosConfig?.jerseyBackName.offsetY ?? jerseyDimensions.height * 0.17;
          fontSize = Math.max(_minFs, Math.min(_maxFs, _targetW / (nombreTexto.length * _charW)));
        }

        // dimensions.width se mantiene < 450 para que Konva no active el centrado automático
        // (TextElement.tsx pasa width al nodo solo cuando > 450). El texto se posiciona
        // mediante offsetX (relativeX del modal), no mediante textAlign-centering.
        const nameWidth = Math.min(400, Math.ceil(fontSize * nombreTexto.length * _charW));

        const nombreEspaldaText: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: { x: offsetX, y: offsetY },
          dimensions: { width: nameWidth, height: Math.ceil(fontSize * 1.3) },
          rotation: 0,
          zIndex: elementCount + 1000,
          locked: false,
          visible: true,
          content: nombreTexto,
          fontFamily: designConfig?.jerseyBackName?.fontFamily ?? 'Arial',
          fontSize,
          fontColor: designConfig?.jerseyBackName?.fontColor ?? '#000000',
          fontColorCmyk: designConfig?.jerseyBackName?.fontColorCmyk,
          textAlign: designConfig?.jerseyBackName?.textAlign ?? "center",
          fontWeight: designConfig?.jerseyBackName?.fontWeight ?? "bold",
          opacity: 1,
          side: "back",
        };
        stagedTexts.push({ element: nombreEspaldaText, parentId: jerseyEspaldaId });
      }
      } // end hasJerseys

      // --- SHORT IZQUIERDO ---
      if (hasShorts) {
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
          fontColorCmyk: designConfig?.shortsNumber?.fontColorCmyk,
          textAlign: designConfig?.shortsNumber?.textAlign ?? "center",
          fontWeight: designConfig?.shortsNumber?.fontWeight ?? "bold",
          opacity: 1,
          side: "front",
        };
        stagedTexts.push({ element: numeroShortRightText, parentId: shortParentId });
      }
      } // end hasShorts

      // --- MANGAS Y CUELLO (opcionales) ---
      // Se generan automáticamente para todos los uniformes del pedido
      // si las imágenes de manga están cargadas en el modal de plantilla.
      // No se requiere ninguna columna extra en el Excel.
      const hasSleevesTemplate = !!(uniformTemplate?.sleeveLeft && uniformTemplate?.sleeveRight);
      const hasCollarTemplate  = !!uniformTemplate?.collar;

      if (hasJerseys && hasSleevesTemplate) {
        const sleeveW = sizeConfig.sleeveWidth  ?? sizeConfig.width  * 0.40;
        const sleeveH = sizeConfig.sleeveHeight ?? sizeConfig.height * 0.50;

        // Manga Izquierda
        stagedUniforms.push({
          id: generateId("uniform"),
          type: "uniform",
          part: "sleeve",
          size: tallaMostrar as any,
          position: { x: 0, y: 0 },
          dimensions: { width: sleeveW, height: sleeveH },
          rotation: 0,
          zIndex: elementCount + 4,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: templateBlobUrls['sleeveLeft'] ?? "",
          templatePiece: 'sleeveLeft',
          side: "left",
          source: 'excel',
          isSvg: isSvgTemplate,
        });

        // Manga Derecha
        stagedUniforms.push({
          id: generateId("uniform"),
          type: "uniform",
          part: "sleeve",
          size: tallaMostrar as any,
          position: { x: 0, y: 0 },
          dimensions: { width: sleeveW, height: sleeveH },
          rotation: 0,
          zIndex: elementCount + 5,
          locked: false,
          visible: true,
          baseColor: "#ffffff",
          imageUrl: templateBlobUrls['sleeveRight'] ?? "",
          templatePiece: 'sleeveRight',
          side: "right",
          source: 'excel',
          isSvg: isSvgTemplate,
        });

        // Cuello (solo si también está cargado el template)
        if (hasCollarTemplate) {
          const collarW = sizeConfig.collarWidth  ?? sizeConfig.width  * 0.30;
          const collarH = sizeConfig.collarHeight ?? sizeConfig.width  * 0.09;
          stagedUniforms.push({
            id: generateId("uniform"),
            type: "uniform",
            part: "collar",
            size: tallaMostrar as any,
            position: { x: 0, y: 0 },
            dimensions: { width: collarW, height: collarH },
            rotation: 0,
            zIndex: elementCount + 6,
            locked: false,
            visible: true,
            baseColor: "#ffffff",
            imageUrl: templateBlobUrls['collar'] ?? "",
            templatePiece: 'collar',
            source: 'excel',
            isSvg: isSvgTemplate,
          });
        }
      }

      onProgress(processedCount, rows.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // --- Generar máscaras bitmap para compaction por silueta real ---
    const bitmaps = new Map<string, BitmapMask>();
    if (isSvgTemplate) {
      const seenKeys = new Set<string>();
      const maskPromises: Promise<void>[] = [];

      for (const u of stagedUniforms) {
        if (!u.imageUrl || !u.isSvg) continue;
        const wk = Math.round(u.dimensions.width);
        const hk = Math.round(u.dimensions.height);
        const key = u.rotation !== 0
          ? `${u.imageUrl}:${wk}:${hk}:${u.rotation}`
          : `${u.imageUrl}:${wk}:${hk}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        maskPromises.push(
          generateBitmapMask(u.imageUrl, u.dimensions.width, u.dimensions.height, u.rotation)
            .then(mask => { if (mask) bitmaps.set(key, mask); }),
        );
      }

      await Promise.all(maskPromises);
    }

    // --- POST-PROCESO: MaxRects asigna posiciones óptimas ---
    const result = optimizeLayoutAdvanced(stagedUniforms, canvasConfig, {
      elementGap: 5,
      canvasMargin: 0,
      canvasMarginV: 0,
      allowRotation: false,
      sortStrategy: 'area',
      heuristic: 'BL',
      bitmaps: bitmaps.size > 0 ? bitmaps : undefined,
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
