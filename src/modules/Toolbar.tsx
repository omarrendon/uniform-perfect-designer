import React, { useState, useRef } from "react";
import {
  Type,
  Shirt,
  Image as ImageIcon,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  FileUp,
  Plus,
  Settings,
} from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import type {
  Size,
  TextElement,
  UniformTemplate,
  CanvasElement,
  SizeSpanish,
} from "../types";
import {
  generateId,
  findValidPosition,
  hasSpaceForElement,
} from "../utils/canvas";
import { readExcelFile, validateExcelFile } from "../utils/excelReader";
import { ErrorModal } from "../components/ErrorModal";
import { BulkLoadingOverlay } from "../components/BulkLoadingOverlay";
import { loadImage } from "../utils/imageCache";
import { compressImageForCanvas } from "../utils/imageCompressorForCanvas";
import {
  loadGoogleFont,
  getValidFontOrFallback,
  GOOGLE_FONTS,
} from "../utils/fontLoader";

export const Toolbar: React.FC = () => {
  const {
    selectedElementId,
    elements,
    addElement,
    deleteElement,
    duplicateElement,
    updateElement,
    bringToFront,
    sendToBack,
    sizeConfigs,
    canvasConfig,
    isSizeComplete,
    setCanvasHidden,
  } = useDesignerStore();

  const [activeSection, setActiveSection] = useState<"add" | "edit">("add");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    details?: string[];
  }>({
    title: "",
    message: "",
    details: [],
  });
  const [showBulkLoading, setShowBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // Verificar si hay espacio para agregar nuevos uniformes
  const sizeConfig = sizeConfigs[2]; // Default M
  // ROTACIÓN 0°: Dimensiones normales (sin rotación)
  const jerseyDimensions = {
    width: sizeConfig.width,
    height: sizeConfig.height,
  };
  // Los shorts verticales: ancho reducido, alto aumentado
  const shortsDimensions = {
    width: sizeConfig.width * 0.45,
    height: sizeConfig.height * 2.2,
  };

  const canAddJersey = hasSpaceForElement(
    jerseyDimensions,
    elements,
    canvasConfig
  );
  const canAddShorts = hasSpaceForElement(
    shortsDimensions,
    elements,
    canvasConfig
  );

  const handleAddUniform = (part: "jersey" | "shorts") => {
    const sizeConfig = sizeConfigs[2]; // Default M
    const { canvasConfig } = useDesignerStore.getState();

    // Dimensiones ajustadas según el tipo de uniforme
    // ROTACIÓN 0°: Dimensiones normales (sin rotación)
    const dimensions =
      part === "shorts"
        ? {
            // Shorts verticales: ancho reducido, alto aumentado
            width: sizeConfig.width * 0.45,
            height: sizeConfig.height * 2.2,
          }
        : {
            // Jersey: dimensiones normales con rotación 0°
            width: sizeConfig.width,
            height: sizeConfig.height,
          };

    // Encontrar una posición válida sin colisiones
    const validPosition = findValidPosition(dimensions, elements, canvasConfig);

    const newUniform: UniformTemplate = {
      id: generateId("uniform"),
      type: "uniform",
      part,
      size: sizeConfig.size,
      position: validPosition,
      dimensions,
      rotation: 0, // Sin rotación
      zIndex: elements.length,
      locked: false,
      visible: true,
      baseColor: "#3b82f6",
      // Agregar imagen de moldes según el tipo de uniforme
      imageUrl:
        part === "shorts"
          ? "/moldes/shorts-moldes.png"
          : "/moldes/PLAYERA TALLA M.png",
    };

    addElement(newUniform);
  };

  const handleAddText = () => {
    const { canvasConfig } = useDesignerStore.getState();

    const dimensions = { width: 200, height: 50 };

    // Encontrar una posición válida sin colisiones
    const validPosition = findValidPosition(dimensions, elements, canvasConfig);

    const newText: TextElement = {
      id: generateId("text"),
      type: "text",
      part: "jersey",
      size: "M",
      position: validPosition,
      dimensions,
      rotation: 0,
      zIndex: elements.length,
      locked: false,
      visible: true,
      content: "Texto",
      fontFamily: "Arial",
      fontSize: 24,
      fontColor: "#000000",
      textAlign: "center",
      fontWeight: "normal",
      opacity: 1,
      side: "front",
    };

    addElement(newText);
  };

  const handleExcelUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo Excel
    if (!validateExcelFile(file)) {
      alert("Por favor selecciona un archivo Excel válido (.xlsx o .xls)");
      return;
    }

    try {
      // Leer el archivo Excel
      const rows = await readExcelFile(file);

      if (rows.length === 0) {
        alert("El archivo Excel está vacío");
        return;
      }

      // VALIDACIÓN: Verificar que todas las tallas del Excel tengan imágenes configuradas
      const tallasEnExcel = new Set<string>();
      const tallasSinConfiguracion: string[] = [];

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
          if (!images?.shorts) faltantes.push('Short');

          tallasSinConfiguracion.push(
            `Talla "${tallaExcel.toUpperCase()}" - Faltan: ${faltantes.join(', ')}`
          );
        }
      });

      // Si hay tallas sin configuración, mostrar error y detener
      if (tallasSinConfiguracion.length > 0) {
        setErrorDetails({
          title: "Tallas sin configurar",
          message: "El archivo Excel contiene tallas que no tienen imágenes configuradas. Por favor, configura las imágenes de todas las tallas antes de continuar.",
          details: tallasSinConfiguracion,
        });
        setShowErrorModal(true);
        return;
      }

      // Obtener el estado actual
      const { canvasConfig, addPage } = useDesignerStore.getState();

      // Función para obtener el molde de frente según la talla
      // USA IMÁGENES COMPRIMIDAS para el canvas (originales se usan en PDF)
      const getMoldeFrenteUrl = (tallaExcel: string): string => {
        const talla = tallaExcel.toLowerCase().trim();
        const tallaSpanish = excelToSpanish[talla];
        if (!tallaSpanish) return "";

        const { uniformSizesConfigCompressed } = useDesignerStore.getState();
        const images = uniformSizesConfigCompressed[tallaSpanish];
        return images?.jerseyFront || "";
      };

      // Función para obtener el molde de espalda según la talla
      // USA IMÁGENES COMPRIMIDAS para el canvas (originales se usan en PDF)
      const getMoldeEspaldaUrl = (tallaExcel: string): string => {
        const talla = tallaExcel.toLowerCase().trim();
        const tallaSpanish = excelToSpanish[talla];
        if (!tallaSpanish) return "";

        const { uniformSizesConfigCompressed } = useDesignerStore.getState();
        const images = uniformSizesConfigCompressed[tallaSpanish];
        return images?.jerseyBack || "";
      };

      // Función para obtener el molde de short según la talla
      // USA IMÁGENES COMPRIMIDAS para el canvas (originales se usan en PDF)
      const getShortConfig = (tallaExcel: string): { url: string; width: number; height: number } => {
        const talla = tallaExcel.toLowerCase().trim();
        const tallaSpanish = excelToSpanish[talla];
        if (!tallaSpanish) return { url: "", width: 380, height: 265 };

        const { uniformSizesConfigCompressed } = useDesignerStore.getState();
        const images = uniformSizesConfigCompressed[tallaSpanish];
        // Usar dimensiones por defecto, se ajustarán según sizeConfig
        return { url: images?.shorts || "", width: 380, height: 265 };
      };

      // Función para obtener la configuración de talla
      const getSizeConfig = (tallaExcel: string) => {
        const tallaUpper = tallaExcel.toUpperCase().trim();

        // Para 2XL y 3XL, usar XL como base
        if (tallaUpper === "2XL" || tallaUpper === "3XL") {
          return sizeConfigs.find(s => s.size === "XL") || sizeConfigs[2];
        }

        const talla = tallaUpper as Size;
        return (
          sizeConfigs.find(s => s.size === talla) || sizeConfigs[2]
        ); // Default M
      };

      // OCULTAR EL CANVAS para evitar renderizados intermedios
      setCanvasHidden(true);

      // Mostrar loading overlay
      setShowBulkLoading(true);
      setBulkProgress({ current: 0, total: rows.length });

      // Pequeño delay para que el loading se muestre antes de empezar el procesamiento
      await new Promise(resolve => setTimeout(resolve, 100));

      // Pre-cargar todas las imágenes en el caché ANTES de empezar a crear elementos
      // Esto evita que se intenten cargar múltiples veces durante el renderizado
      console.log('Pre-cargando imágenes en caché...');
      const imagesToPreload = new Set<string>();

      // Recopilar todas las URLs de imágenes únicas que se usarán
      const currentUniformConfig = useDesignerStore.getState().uniformSizesConfig;
      rows.forEach(row => {
        const tallaExcel = (row.talla || 'm').toLowerCase().trim();
        const tallaSpanish = excelToSpanish[tallaExcel];
        if (tallaSpanish && currentUniformConfig[tallaSpanish]) {
          const images = currentUniformConfig[tallaSpanish];
          if (images.jerseyFront) imagesToPreload.add(images.jerseyFront);
          if (images.jerseyBack) imagesToPreload.add(images.jerseyBack);
          if (images.shorts) imagesToPreload.add(images.shorts);
        }
      });

      // COMPRIMIR imágenes para el canvas (mantiene originales para PDF)
      console.log(`Comprimiendo ${imagesToPreload.size} imágenes para el canvas...`);
      const storeState = useDesignerStore.getState();
      const uniformSizesConfigOriginal = storeState.uniformSizesConfig;
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
          if (images.shorts) {
            compressedConfig[tallaSpanish].shorts = await compressImageForCanvas(images.shorts);
          }

          // Pausa entre cada talla
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Guardar imágenes comprimidas en el store
      useDesignerStore.setState({ uniformSizesConfigCompressed: compressedConfig });
      console.log(`✓ Imágenes comprimidas para canvas (originales intactas para PDF)`);

      // Pre-cargar las imágenes COMPRIMIDAS en el caché
      console.log(`Pre-cargando imágenes comprimidas en caché...`);
      let preloadCount = 0;
      for (const url of imagesToPreload) {
        // Buscar la versión comprimida
        let compressedUrl = url;
        for (const tallaSpanish of Object.keys(compressedConfig) as SizeSpanish[]) {
          const imgs = compressedConfig[tallaSpanish];
          if (imgs.jerseyFront === url || imgs.jerseyBack === url || imgs.shorts === url) {
            // Usar la versión comprimida
            compressedUrl = imgs.jerseyFront === url ? imgs.jerseyFront :
                           imgs.jerseyBack === url ? imgs.jerseyBack : imgs.shorts;
            break;
          }
        }

        await new Promise<void>((resolve) => {
          loadImage(compressedUrl, () => {
            preloadCount++;
            resolve();
          });
        });
        // Pausa entre cada imagen pre-cargada: 200ms
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`✓ Todas las imágenes pre-cargadas en caché`);

      // Pausa después de pre-cargar: 500ms
      await new Promise(resolve => setTimeout(resolve, 500));

      // Obtener todas las páginas actuales
      const { pages } = useDesignerStore.getState();

      // Array temporal para mantener los elementos de la página actual
      let currentElements = pages[0] ? [...pages[0]] : [];
      let currentPageIndex = 0;

      // Contadores para tracking
      const shortsPerPage: { [pageIndex: number]: number } = {};

      // Por cada fila del Excel, crear un juego de playera (espalda + frente)
      let processedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (!row.nombre || row.nombre.trim() === "") {
          continue; // Saltar filas sin nombre
        }

        // Obtener la talla de la fila (default "M" si no existe)
        const tallaExcel = row.talla || "m";
        const sizeConfig = getSizeConfig(tallaExcel);
        // Talla para mostrar en el molde (usar la talla original del Excel en mayúsculas)
        const tallaMostrar = tallaExcel.toUpperCase().trim();

        // Obtener la fuente de la fila (default "Arial" si no existe)
        const fonteFila = getValidFontOrFallback(row.fuente, "Arial");

        // Cargar la fuente de Google Fonts si no es Arial
        if (fonteFila !== "Arial") {
          await loadGoogleFont(fonteFila);
        }

        // Dimensiones de jersey con rotación 0°
        const jerseyDimensions = {
          width: sizeConfig.width,
          height: sizeConfig.height,
        };

        const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;
        const elementGap = 5;

        // 1. Crear Jersey ESPALDA (columna 1 - izquierda)
        // Filtrar solo jerseys en la columna 1 (primera columna izquierda)
        const jerseysCol1 = currentElements.filter(
          el => el.type === "uniform" && el.part === "jersey" && el.position.x < jerseyDimensions.width + elementGap
        );

        let espaldaX = 0;
        let espaldaY = 0;

        if (jerseysCol1.length > 0) {
          // Buscar el Y máximo en la columna 1
          const maxY = Math.max(...jerseysCol1.map(j => j.position.y + j.dimensions.height));
          espaldaY = maxY + elementGap;

          // Verificar si cabe en la columna
          if (espaldaY + jerseyDimensions.height > canvasHeight) {
            // No cabe, crear nueva página
            addPage();
            currentPageIndex++;
            currentElements = [];
            espaldaX = 0;
            espaldaY = 0;
          }
        }

        const jerseyEspalda = { x: espaldaX, y: espaldaY };

        const newJerseyEspalda: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyEspalda,
          dimensions: jerseyDimensions,
          rotation: 0, // Sin rotación
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: getMoldeEspaldaUrl(tallaExcel),
        };

        currentElements.push(newJerseyEspalda);
        addElement(newJerseyEspalda, currentPageIndex);

        // Crear elemento de texto con el nombre para el molde de espalda
        const textoDimensions = { width: jerseyDimensions.width * 0.8, height: 50 };
        const textoPosition = {
          x: jerseyEspalda.x + (jerseyDimensions.width - textoDimensions.width) / 2 + 150, // Centrado horizontalmente + 150px a la derecha
          y: jerseyEspalda.y + jerseyDimensions.height / 2 - 100, // Centrado y subido 100 píxeles
        };

        const newTextoNombre: TextElement = {
          id: generateId("text"),
          type: "text",
          part: "jersey",
          size: tallaMostrar as any,
          position: textoPosition,
          dimensions: textoDimensions,
          rotation: 0,
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          content: row.nombre,
          fontFamily: fonteFila,
          fontSize: 32,
          fontColor: "#000000",
          textAlign: "center",
          fontWeight: "bold",
          opacity: 1,
          side: "front",
        };

        currentElements.push(newTextoNombre);
        addElement(newTextoNombre, currentPageIndex);

        // Crear elemento de texto con el número trasero para el molde de espalda (si existe)
        if (row.numero_trasero) {
          const numeroFontSize = 102; // 52 + 50 píxeles
          const numeroTextoDimensions = { width: jerseyDimensions.width * 0.8, height: numeroFontSize + 20 };
          const numeroTextoPosition = {
            x: jerseyEspalda.x + (jerseyDimensions.width - numeroTextoDimensions.width) / 2 + 30, // Centrado horizontalmente + 30px a la derecha
            y: jerseyEspalda.y + (jerseyDimensions.height - numeroTextoDimensions.height) / 2 + 20, // Centrado verticalmente + 20px abajo
          };

          const newTextoNumero: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: numeroTextoPosition,
            dimensions: numeroTextoDimensions,
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_trasero),
            fontFamily: fonteFila,
            fontSize: numeroFontSize,
            fontColor: "#000000",
            textAlign: "center",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(newTextoNumero);
          addElement(newTextoNumero, currentPageIndex);
        }

        // 2. Crear Jersey FRENTE (columna 2 - centro)
        // Filtrar solo jerseys en la columna 2 (segunda columna)
        const col2X = jerseyDimensions.width + elementGap;
        const jerseysCol2 = currentElements.filter(
          el => el.type === "uniform" && el.part === "jersey" &&
          el.position.x >= col2X && el.position.x < col2X + jerseyDimensions.width + elementGap
        );

        let frenteX = col2X;
        let frenteY = 0;

        if (jerseysCol2.length > 0) {
          // Buscar el Y máximo en la columna 2
          const maxY = Math.max(...jerseysCol2.map(j => j.position.y + j.dimensions.height));
          frenteY = maxY + elementGap;

          // Verificar si cabe en la columna
          if (frenteY + jerseyDimensions.height > canvasHeight) {
            // No cabe, crear nueva página
            addPage();
            currentPageIndex++;
            currentElements = [];
            frenteX = col2X;
            frenteY = 0;
          }
        }

        const jerseyFrente = { x: frenteX, y: frenteY };

        const newJerseyFrente: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: tallaMostrar as any,
          position: jerseyFrente,
          dimensions: jerseyDimensions,
          rotation: 0, // Sin rotación
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: getMoldeFrenteUrl(tallaExcel),
        };

        currentElements.push(newJerseyFrente);
        addElement(newJerseyFrente, currentPageIndex);

        // Crear elemento de texto con el número frontal para el molde de frente (si existe)
        if (row.numero_frente) {
          const numeroFrenteFontSize = 32; // Mismo tamaño que el nombre
          const numeroFrenteTextoDimensions = { width: 100, height: numeroFrenteFontSize + 20 };
          const numeroFrenteTextoPosition = {
            x: jerseyFrente.x + jerseyDimensions.width - numeroFrenteTextoDimensions.width - 20, // Esquina superior derecha con margen
            y: jerseyFrente.y + 20, // Parte superior con margen
          };

          const newTextoNumeroFrente: TextElement = {
            id: generateId("text"),
            type: "text",
            part: "jersey",
            size: tallaMostrar as any,
            position: numeroFrenteTextoPosition,
            dimensions: numeroFrenteTextoDimensions,
            rotation: 0,
            zIndex: currentElements.length,
            locked: false,
            visible: true,
            content: String(row.numero_frente),
            fontFamily: fonteFila,
            fontSize: numeroFrenteFontSize,
            fontColor: "#000000",
            textAlign: "right",
            fontWeight: "bold",
            opacity: 1,
            side: "front",
          };

          currentElements.push(newTextoNumeroFrente);
          addElement(newTextoNumeroFrente, currentPageIndex);
        }

        // 3. Crear PAR DE SHORTS (columna 3 - UNA SOLA columna vertical pegada a la derecha)
        // Obtener configuración del short (URL y dimensiones reales)
        const shortConfig = getShortConfig(tallaExcel);
        const shortsDimensions = {
          width: shortConfig.width,
          height: shortConfig.height,
        };

        // Calcular espacio necesario para el par (dos shorts verticalmente)
        const pairHeight = shortsDimensions.height * 2 + elementGap;

        // Posición X FIJA: PEGADO AL BORDE DERECHO del canvas
        // Esta X NUNCA cambia - todos los shorts van en esta misma X
        const canvasWidth = canvasConfig.width * canvasConfig.pixelsPerCm;
        const shortsColumnX = canvasWidth - shortsDimensions.width;

        // ⚡ CRÍTICO: OBTENER ESTADO FRESCO del store DESPUÉS de agregar jerseys
        // Esto asegura que tengamos la información actualizada de todas las páginas
        let storeState = useDesignerStore.getState();
        let allPages = storeState.pages;

        // ESTRATEGIA: Intentar colocar shorts en página actual primero,
        // si no caben, intentar en página anterior (si existe y tiene espacio),
        // si tampoco, crear nueva página

        let shortsPageIndex = currentPageIndex;
        let pairY = 0;
        let foundSpace = false;

        // Verificar página actual (con estado FRESCO)
        const currentPageElements = allPages[currentPageIndex] || [];
        const shortsInCurrentPage = currentPageElements.filter(
          el => el.type === "uniform" && el.part === "shorts"
        );

        if (shortsInCurrentPage.length > 0) {
          const maxY = Math.max(...shortsInCurrentPage.map(s => s.position.y + s.dimensions.height));
          pairY = maxY + elementGap;
        }

        // ESTRATEGIA MEJORADA: Buscar en TODAS las páginas desde la 0 hasta la actual
        // Intentar llenar las páginas anteriores primero antes de usar la actual

        // Buscar en todas las páginas existentes, empezando desde la 0
        for (let pageIndex = 0; pageIndex <= currentPageIndex; pageIndex++) {
          // Refrescar estado
          storeState = useDesignerStore.getState();
          allPages = storeState.pages;

          const pageElements = allPages[pageIndex] || [];
          const shortsInPage = pageElements.filter(
            el => el.type === "uniform" && el.part === "shorts"
          );

          let pagePairY = 0;
          if (shortsInPage.length > 0) {
            const maxY = Math.max(...shortsInPage.map(s => s.position.y + s.dimensions.height));
            pagePairY = maxY + elementGap;
          }

          // ¿Cabe en esta página?
          if (pagePairY + pairHeight <= canvasHeight) {
            foundSpace = true;
            shortsPageIndex = pageIndex;
            pairY = pagePairY;
            break; // Usar la primera página donde cabe
          }
        }

        // Si no encontró espacio en ninguna página existente, crear nueva
        if (!foundSpace) {
          addPage();
          currentPageIndex++;
          shortsPageIndex = currentPageIndex;
          currentElements = [];
          pairY = 0;
        }

        // ⚡ REFRESCAR estado una vez más antes de obtener zIndex
        storeState = useDesignerStore.getState();
        allPages = storeState.pages;

        // Obtener zIndex correcto basado en la página donde van los shorts
        let targetPageElements = allPages[shortsPageIndex] || [];
        const baseZIndex = targetPageElements.length;

        // Crear SHORT 1 (arriba, normal) - SIEMPRE en shortsColumnX
        const short1Position = { x: shortsColumnX, y: pairY };
        const newShort1: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: short1Position,
          dimensions: shortsDimensions,
          rotation: 0,
          zIndex: baseZIndex,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: shortConfig.url,
        };

        // Si los shorts van en página diferente a la actual, actualizar currentElements
        if (shortsPageIndex === currentPageIndex) {
          currentElements.push(newShort1);
        }
        addElement(newShort1, shortsPageIndex);

        // Refrescar el estado después de agregar Short 1
        const updatedState = useDesignerStore.getState();
        targetPageElements = updatedState.pages[shortsPageIndex] || [];

        // Crear SHORT 2 (abajo, invertido 180°) - SIEMPRE en shortsColumnX
        const short2Position = {
          x: shortsColumnX,
          y: pairY + shortsDimensions.height + elementGap,
        };

        const newShort2: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: tallaMostrar as any,
          position: short2Position,
          dimensions: shortsDimensions,
          rotation: 180, // Rotado 180° para quedar de cabeza
          zIndex: targetPageElements.length, // Usar la longitud actualizada
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: shortConfig.url,
        };

        // Si los shorts van en página diferente a la actual, actualizar currentElements
        if (shortsPageIndex === currentPageIndex) {
          currentElements.push(newShort2);
        }
        addElement(newShort2, shortsPageIndex);

        // Incrementar contador de shorts por página
        if (!shortsPerPage[shortsPageIndex]) {
          shortsPerPage[shortsPageIndex] = 0;
        }
        shortsPerPage[shortsPageIndex] += 2; // Un par = 2 shorts

        // Actualizar progreso
        processedCount++;
        setBulkProgress({ current: processedCount, total: rows.length });

        // PROCESAMIENTO POR LOTES: Cada 5 uniformes, hacer una pausa LARGA
        // para permitir limpieza de memoria
        if (processedCount % 5 === 0) {
          // Pausa de 3 segundos cada 5 uniformes
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          // Pausa pequeña entre uniformes del mismo lote
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Mostrar resumen final
      console.log('\n========== RESUMEN DE DISTRIBUCIÓN DE SHORTS ==========');
      const finalState = useDesignerStore.getState();
      const finalPages = finalState.pages;

      for (let i = 0; i < finalPages.length; i++) {
        const pageElements = finalPages[i] || [];
        const shortsInPage = pageElements.filter(el => el.type === "uniform" && el.part === "shorts");
        const pairsInPage = shortsInPage.length / 2;

        // Calcular espacio usado y disponible
        if (shortsInPage.length > 0) {
          const maxY = Math.max(...shortsInPage.map(s => s.position.y + s.dimensions.height));
          const spaceUsed = maxY;
          const spaceAvailable = canvasConfig.height * canvasConfig.pixelsPerCm - maxY;
          const canvasHeight = canvasConfig.height * canvasConfig.pixelsPerCm;

          // Obtener dimensiones del primer short para calcular cuántos más caben
          const firstShort = shortsInPage[0];
          const pairHeight = (firstShort.dimensions.height * 2) + 5; // 2 shorts + gap
          const additionalPairsThatFit = Math.floor(spaceAvailable / pairHeight);
          const maxPairsTheoretical = Math.floor(canvasHeight / pairHeight);

          console.log(`📄 Página ${i}:`);
          console.log(`   - Shorts REALES agregados: ${shortsInPage.length} (${pairsInPage} pares)`);
          console.log(`   - Shorts TEÓRICOS que caben: ${maxPairsTheoretical * 2} (${maxPairsTheoretical} pares)`);
          console.log(`   - Espacio usado: ${spaceUsed.toFixed(0)}px / ${canvasHeight.toFixed(0)}px (${(spaceUsed/canvasHeight*100).toFixed(1)}%)`);
          console.log(`   - Espacio disponible: ${spaceAvailable.toFixed(0)}px (caben ${additionalPairsThatFit} pares más)`);

          if (pairsInPage < maxPairsTheoretical) {
            console.log(`   ⚠️ ADVERTENCIA: Faltan ${maxPairsTheoretical - pairsInPage} pares que deberían caber!`);
          } else if (pairsInPage === maxPairsTheoretical) {
            console.log(`   ✅ Página optimizada al máximo`);
          }
        }
      }
      console.log('=======================================================\n');

      const totalPagesUsed = currentPageIndex + 1;

      // Ocultar loading
      setShowBulkLoading(false);

      // MOSTRAR EL CANVAS nuevamente
      setCanvasHidden(false);

      alert(`Se crearon ${rows.length} juegos completos (espalda + frente + 2 shorts) exitosamente en ${totalPagesUsed} página(s)!`);
    } catch (error) {
      console.error("Error al procesar el archivo Excel:", error);

      // Ocultar loading en caso de error
      setShowBulkLoading(false);

      // MOSTRAR EL CANVAS en caso de error
      setCanvasHidden(false);

      // Mostrar error específico si está disponible
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      setErrorDetails({
        title: "Error al procesar Excel",
        message: "Ocurrió un error al procesar el archivo Excel.",
        details: [errorMessage],
      });
      setShowErrorModal(true);
    }

    // Limpiar el input para permitir cargar el mismo archivo de nuevo
    event.target.value = "";
  };

  // Abrir sección de edición automáticamente cuando se selecciona un elemento
  React.useEffect(() => {
    if (selectedElement) {
      setActiveSection("edit");
    }
  }, [selectedElement]);

  return (
    <div className="w-1/4 min-w-[300px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-lg">
      {/* Header con pestañas */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection("add")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeSection === "add"
                ? "bg-white text-blue-700 shadow-lg"
                : "bg-blue-500/30 text-white hover:bg-blue-500/50"
            }`}
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
          <button
            onClick={() => setActiveSection("edit")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeSection === "edit"
                ? "bg-white text-blue-700 shadow-lg"
                : "bg-blue-500/30 text-white hover:bg-blue-500/50"
            }`}
          >
            <Settings className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeSection === "add" ? (
          <AddTab
            onAddUniform={handleAddUniform}
            onAddText={handleAddText}
            onExcelUpload={handleExcelUpload}
            canAddJersey={canAddJersey}
            canAddShorts={canAddShorts}
          />
        ) : (
          <EditTab
            element={selectedElement}
            onUpdate={updateElement}
            onDelete={deleteElement}
            onDuplicate={duplicateElement}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
          />
        )}
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorDetails.title}
        message={errorDetails.message}
        details={errorDetails.details}
      />

      {/* Bulk Loading Overlay */}
      <BulkLoadingOverlay
        isVisible={showBulkLoading}
        currentUniform={bulkProgress.current}
        totalUniforms={bulkProgress.total}
      />
    </div>
  );
};

const AddTab: React.FC<{
  onAddUniform: (part: "jersey" | "shorts") => void;
  onAddText: () => void;
  onExcelUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  canAddJersey: boolean;
  canAddShorts: boolean;
}> = ({
  onAddUniform,
  onAddText,
  onExcelUpload,
  canAddJersey,
  canAddShorts,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Uniformes */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Uniformes
        </h3>
        <div className="space-y-2.5">
          <button
            onClick={() => onAddUniform("jersey")}
            disabled={!canAddJersey}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 disabled:from-gray-50 disabled:to-gray-100 border border-blue-200 disabled:border-gray-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 group-hover:bg-blue-700 group-disabled:bg-gray-400 rounded-lg flex items-center justify-center transition-colors">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-800 group-disabled:text-gray-500">
                  Agregar Playera
                </p>
                <p className="text-xs text-gray-600 group-disabled:text-gray-400">
                  Molde de jersey
                </p>
              </div>
            </div>
            {!canAddJersey && (
              <div className="absolute bottom-1 right-3">
                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  Sin espacio
                </span>
              </div>
            )}
          </button>

          <button
            onClick={() => onAddUniform("shorts")}
            disabled={!canAddShorts}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 disabled:from-gray-50 disabled:to-gray-100 border border-purple-200 disabled:border-gray-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 group-hover:bg-purple-700 group-disabled:bg-gray-400 rounded-lg flex items-center justify-center transition-colors">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-800 group-disabled:text-gray-500">
                  Agregar Short
                </p>
                <p className="text-xs text-gray-600 group-disabled:text-gray-400">
                  Molde de short
                </p>
              </div>
            </div>
            {!canAddShorts && (
              <div className="absolute bottom-1 right-3">
                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  Sin espacio
                </span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Carga Masiva */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Carga Masiva
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onExcelUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={handleExcelButtonClick}
          className="w-full group bg-gradient-to-r from-green-50 to-emerald-100 hover:from-green-100 hover:to-emerald-200 border border-green-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 group-hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors">
              <FileUp className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-800">Cargar desde Excel</p>
              <p className="text-xs text-gray-600">Importar múltiples diseños</p>
            </div>
          </div>
        </button>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Columnas requeridas:</span> nombre, talla
            <br />
            <span className="font-semibold">Columnas opcionales:</span> numero_trasero, numero_frente, fuente
          </p>
        </div>
      </div>

      {/* Texto */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Elementos
        </h3>
        <div className="space-y-2.5">
          <button
            onClick={onAddText}
            className="w-full group bg-gradient-to-r from-orange-50 to-amber-100 hover:from-orange-100 hover:to-amber-200 border border-orange-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 group-hover:bg-orange-700 rounded-lg flex items-center justify-center transition-colors">
                <Type className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-800">Agregar Texto</p>
                <p className="text-xs text-gray-600">Texto personalizado</p>
              </div>
            </div>
          </button>

          <button
            disabled
            className="w-full group bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 cursor-not-allowed opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-600">Agregar Imagen</p>
                <p className="text-xs text-gray-500">Próximamente</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const EditTab: React.FC<{
  element: CanvasElement | undefined;
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}> = ({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
}) => {
  const { sizeConfigs } = useDesignerStore();

  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Settings className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600 text-center">
          Selecciona un elemento en el canvas
        </p>
        <p className="text-xs text-gray-500 text-center mt-2">
          Haz clic en cualquier elemento para editarlo
        </p>
      </div>
    );
  }

  const sizes: Size[] = ["XS", "S", "M", "L", "XL"];

  const handleSizeChange = (newSize: Size) => {
    const sizeConfig = sizeConfigs.find(s => s.size === newSize);
    if (sizeConfig && element.type === "uniform") {
      onUpdate(element.id, {
        size: newSize,
        dimensions: {
          width: sizeConfig.width,
          height:
            element.part === "shorts"
              ? sizeConfig.height * 0.6
              : sizeConfig.height,
        },
      });
    } else {
      onUpdate(element.id, { size: newSize });
    }
  };

  return (
    <div className="space-y-5">
      {/* Indicador de tipo de elemento */}
      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
          {element.type === "uniform" ? "Uniforme" : "Texto"} Seleccionado
        </p>
        <p className="text-xs text-blue-600 mt-0.5">
          {element.type === "uniform"
            ? `${element.part === "jersey" ? "Playera" : "Short"} - Talla ${element.size}`
            : element.type === "text"
            ? element.content
            : "Imagen"}
        </p>
      </div>

      {/* Acciones Rápidas */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onDuplicate(element.id)}
            className="flex items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Duplicar</span>
          </button>
          <button
            onClick={() => onDelete(element.id)}
            className="flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">Eliminar</span>
          </button>
          <button
            onClick={() => onUpdate(element.id, { visible: !element.visible })}
            className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
              element.visible
                ? "bg-green-50 hover:bg-green-100 border-green-200"
                : "bg-gray-50 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {element.visible ? (
              <>
                <Eye className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Oculto</span>
              </>
            )}
          </button>
          <button
            onClick={() => onUpdate(element.id, { locked: !element.locked })}
            className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
              element.locked
                ? "bg-orange-50 hover:bg-orange-100 border-orange-200"
                : "bg-gray-50 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {element.locked ? (
              <>
                <Lock className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Bloqueado</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Libre</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Capas */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Orden de Capas
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onBringToFront(element.id)}
            className="flex items-center justify-center gap-2 p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <ArrowUp className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">Al frente</span>
          </button>
          <button
            onClick={() => onSendToBack(element.id)}
            className="flex items-center justify-center gap-2 p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <ArrowDown className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">Atrás</span>
          </button>
        </div>
      </div>

      {element.type === "uniform" && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Propiedades del Uniforme
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Talla
                </label>
                <select
                  value={element.size}
                  onChange={e => handleSizeChange(e.target.value as Size)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {sizes.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Color Base
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={element.baseColor}
                    onChange={e =>
                      onUpdate(element.id, { baseColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={element.baseColor}
                      onChange={e =>
                        onUpdate(element.id, { baseColor: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {element.type === "text" && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Propiedades del Texto
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Contenido
                </label>
                <input
                  type="text"
                  value={element.content}
                  onChange={e => onUpdate(element.id, { content: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Tamaño
                  </label>
                  <input
                    type="number"
                    value={element.fontSize}
                    onChange={e =>
                      onUpdate(element.id, { fontSize: Number(e.target.value) })
                    }
                    min={10}
                    max={200}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={element.fontColor}
                      onChange={e =>
                        onUpdate(element.id, { fontColor: e.target.value })
                      }
                      className="w-full h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Fuente
                </label>
                <select
                  value={element.fontFamily}
                  onChange={async e => {
                    const newFont = e.target.value;
                    if (newFont !== "Arial") {
                      await loadGoogleFont(newFont);
                    }
                    onUpdate(element.id, { fontFamily: newFont });
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {GOOGLE_FONTS.map(font => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Google Fonts disponibles
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Alineación
                  </label>
                  <select
                    value={element.textAlign}
                    onChange={e =>
                      onUpdate(element.id, {
                        textAlign: e.target.value as "left" | "center" | "right",
                      })
                    }
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Peso
                  </label>
                  <select
                    value={element.fontWeight}
                    onChange={e =>
                      onUpdate(element.id, {
                        fontWeight: e.target.value as "normal" | "bold",
                      })
                    }
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Negrita</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Transformación
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">
                Rotación
              </label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                {element.rotation}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={element.rotation}
              onChange={e =>
                onUpdate(element.id, { rotation: Number(e.target.value) })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(element.rotation / 360) * 100}%, #e5e7eb ${(element.rotation / 360) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
