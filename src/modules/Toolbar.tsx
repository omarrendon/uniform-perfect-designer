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
} from "../types";
import {
  generateId,
  findValidPosition,
  hasSpaceForElement,
} from "../utils/canvas";
import { readExcelFile, validateExcelFile } from "../utils/excelReader";
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
  } = useDesignerStore();

  const [activeSection, setActiveSection] = useState<"add" | "edit">("add");

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

      // Obtener el estado actual
      const { canvasConfig, addPage } = useDesignerStore.getState();

      // Función para mapear talla del Excel a nombre de archivo (para espalda)
      const mapSizeToMoldeName = (tallaExcel: string): string => {
        const talla = tallaExcel.toLowerCase().trim();
        const sizeMap: Record<string, string> = {
          xs: "XS",
          s: "S",
          m: "M",
          l: "L",
          xl: "XL",
          "2xl": "2XL",
          "3xl": "3XL",
        };
        return sizeMap[talla] || "M"; // Default a M si no se reconoce
      };

      // Función para obtener el molde de frente según la talla
      // Solo CH, M y G usan las imágenes TALLA, las demás usan CAB FRENTE
      const getMoldeFrenteUrl = (tallaExcel: string, moldeSize: string): string => {
        const talla = tallaExcel.toLowerCase().trim();
        // Solo estas tallas específicas usan los moldes TALLA
        if (talla === "ch") {
          return "/moldes/TALLA CH.png";
        } else if (talla === "m") {
          return "/moldes/TALLA M.png";
        } else if (talla === "g") {
          return "/moldes/TALLA G.png";
        }
        // Las demás tallas usan los moldes CAB FRENTE originales
        return `/moldes/${moldeSize} CAB FRENTE.png`;
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

      // Obtener todas las páginas actuales
      const { pages } = useDesignerStore.getState();

      // Array temporal para mantener los elementos de la página actual
      let currentElements = pages[0] ? [...pages[0]] : [];
      let currentPageIndex = 0;

      // Por cada fila del Excel, crear un juego de playera (espalda + frente)
      for (const row of rows) {
        if (!row.nombre || row.nombre.trim() === "") {
          continue; // Saltar filas sin nombre
        }

        // Obtener la talla de la fila (default "M" si no existe)
        const tallaExcel = row.talla || "m";
        const moldeSize = mapSizeToMoldeName(tallaExcel);
        const sizeConfig = getSizeConfig(tallaExcel);

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

        // 1. Crear Jersey ESPALDA
        // Filtrar solo los uniformes para el cálculo de posición (ignorar textos superpuestos)
        const uniformElements = currentElements.filter(el => el.type === "uniform");

        // Verificar que haya espacio para el jersey espalda
        if (
          !hasSpaceForElement(jerseyDimensions, uniformElements, canvasConfig)
        ) {
          // No hay espacio en la página actual, crear una nueva página
          addPage();
          currentPageIndex++;
          currentElements = []; // Resetear elementos para la nueva página vacía
        }

        // Filtrar de nuevo después de posible reset
        const uniformElementsForEspalda = currentElements.filter(el => el.type === "uniform");

        const jerseyEspalda = findValidPosition(
          jerseyDimensions,
          uniformElementsForEspalda,
          canvasConfig
        );

        const newJerseyEspalda: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: sizeConfig.size,
          position: jerseyEspalda,
          dimensions: jerseyDimensions,
          rotation: 0, // Sin rotación
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: `/moldes/${moldeSize} CAB ESPALDA.png`,
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
          size: sizeConfig.size,
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
            size: sizeConfig.size,
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

        // 2. Crear Jersey FRENTE
        // Filtrar solo los uniformes para el cálculo de posición (ignorar textos superpuestos)
        const uniformElementsForFrente = currentElements.filter(el => el.type === "uniform");

        // Verificar que haya espacio para el jersey frente
        if (
          !hasSpaceForElement(jerseyDimensions, uniformElementsForFrente, canvasConfig)
        ) {
          // No hay espacio en la página actual, crear una nueva página
          addPage();
          currentPageIndex++;
          currentElements = []; // Resetear elementos para la nueva página vacía
        }

        // Filtrar de nuevo después de posible reset
        const uniformElementsForFrentePos = currentElements.filter(el => el.type === "uniform");

        const jerseyFrente = findValidPosition(
          jerseyDimensions,
          uniformElementsForFrentePos,
          canvasConfig
        );

        const newJerseyFrente: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: sizeConfig.size,
          position: jerseyFrente,
          dimensions: jerseyDimensions,
          rotation: 0, // Sin rotación
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: getMoldeFrenteUrl(tallaExcel, moldeSize),
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
            size: sizeConfig.size,
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
      }

      const totalPagesUsed = currentPageIndex + 1;
      alert(`Se crearon ${rows.length} juegos de playeras (espalda + frente) exitosamente en ${totalPagesUsed} página(s)!`);
    } catch (error) {
      console.error("Error al procesar el archivo Excel:", error);
      alert(
        "Error al procesar el archivo Excel. Verifica que tenga la columna 'nombre'."
      );
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
