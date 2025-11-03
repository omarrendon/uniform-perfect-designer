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
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { Input } from "../components/Input";

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

  const [activeTab, setActiveTab] = useState<"add" | "edit">("add");

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // Verificar si hay espacio para agregar nuevos uniformes
  const sizeConfig = sizeConfigs[2]; // Default M
  // ROTACIÓN 270°: Dimensiones intercambiadas (como 90°)
  const jerseyDimensions = {
    width: sizeConfig.height,
    height: sizeConfig.width,
  };
  // Los shorts con rotación 270°: dimensiones intercambiadas
  const shortsDimensions = {
    width: sizeConfig.height * 0.45,
    height: sizeConfig.width * 2.2,
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
    // ROTACIÓN 270°: Dimensiones intercambiadas (como 90°)
    const dimensions =
      part === "shorts"
        ? {
            // Shorts: dimensiones intercambiadas con rotación 270°
            width: sizeConfig.height * 0.45,
            height: sizeConfig.width * 2.2,
          }
        : {
            // Jersey: dimensiones intercambiadas con rotación 270°
            width: sizeConfig.height,
            height: sizeConfig.width,
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
      rotation: 270, // Rotar 270 grados
      zIndex: elements.length,
      locked: false,
      visible: true,
      baseColor: "#3b82f6",
      // Agregar imagen de moldes según el tipo de uniforme
      imageUrl:
        part === "shorts"
          ? "/moldes/shorts-moldes.png"
          : "/moldes/jersey-molde.png",
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
      const { canvasConfig } = useDesignerStore.getState();
      const sizeConfig = sizeConfigs[2]; // Default M

      // Dimensiones de jersey y shorts con rotación 270°
      // ROTACIÓN 270°: Dimensiones intercambiadas (como 90°)
      const jerseyDimensions = {
        width: sizeConfig.height,
        height: sizeConfig.width,
      };
      const shortsDimensions = {
        width: sizeConfig.height * 0.45,
        height: sizeConfig.width * 2.2,
      };

      // Array temporal para mantener los elementos que se van agregando
      const currentElements = [...elements];

      // Por cada fila del Excel, crear un juego (jersey + shorts)
      for (const row of rows) {
        if (!row.nombre || row.nombre.trim() === "") {
          continue; // Saltar filas sin nombre
        }

        // 1. Crear Jersey
        const jerseyPosition = findValidPosition(
          jerseyDimensions,
          currentElements,
          canvasConfig
        );

        // Verificar que haya espacio para el jersey
        if (
          !hasSpaceForElement(jerseyDimensions, currentElements, canvasConfig)
        ) {
          alert(
            `No hay espacio suficiente para crear el juego de "${
              row.nombre
            }". Se crearon ${rows.indexOf(row)} juegos.`
          );
          break;
        }

        const newJersey: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "jersey",
          size: sizeConfig.size,
          position: jerseyPosition,
          dimensions: jerseyDimensions,
          rotation: 270, // Rotar 270 grados
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: "/moldes/jersey-molde.png",
        };

        currentElements.push(newJersey);
        addElement(newJersey);

        // 2. Crear Shorts
        const shortsPosition = findValidPosition(
          shortsDimensions,
          currentElements,
          canvasConfig
        );

        // Verificar que haya espacio para los shorts
        if (
          !hasSpaceForElement(shortsDimensions, currentElements, canvasConfig)
        ) {
          alert(
            `No hay espacio suficiente para completar el juego de "${row.nombre}". Se crearon jerseys pero faltan shorts.`
          );
          break;
        }

        const newShorts: UniformTemplate = {
          id: generateId("uniform"),
          type: "uniform",
          part: "shorts",
          size: sizeConfig.size,
          position: shortsPosition,
          dimensions: shortsDimensions,
          rotation: 270, // Rotar 270 grados
          zIndex: currentElements.length,
          locked: false,
          visible: true,
          baseColor: "#3b82f6",
          imageUrl: "/moldes/shorts-moldes.png",
        };

        currentElements.push(newShorts);
        addElement(newShorts);
      }

      alert(`Se crearon ${rows.length} juegos de uniformes exitosamente!`);
    } catch (error) {
      console.error("Error al procesar el archivo Excel:", error);
      alert(
        "Error al procesar el archivo Excel. Verifica que tenga la columna 'nombre'."
      );
    }

    // Limpiar el input para permitir cargar el mismo archivo de nuevo
    event.target.value = "";
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === "add"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("add")}
        >
          Agregar
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === "edit"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("edit")}
        >
          Editar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "add" ? (
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Uniformes</h3>
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onAddUniform("jersey")}
            disabled={!canAddJersey}
          >
            <Shirt className="w-4 h-4 mr-2" />
            Agregar Playera
          </Button>
          {!canAddJersey && (
            <p className="text-xs text-red-500 mt-1">
              No hay espacio disponible en el canvas
            </p>
          )}
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onAddUniform("shorts")}
            disabled={!canAddShorts}
          >
            <Shirt className="w-4 h-4 mr-2" />
            Agregar Short
          </Button>
          {!canAddShorts && (
            <p className="text-xs text-red-500 mt-1">
              No hay espacio disponible en el canvas
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Carga Masiva
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onExcelUpload}
          style={{ display: "none" }}
        />
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={handleExcelButtonClick}
        >
          <FileUp className="w-4 h-4 mr-2" />
          Cargar desde Excel
        </Button>
        <p className="text-xs text-gray-500 mt-1">
          Carga un archivo Excel con columna "nombre" para generar juegos de
          uniformes
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Texto</h3>
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={onAddText}
        >
          <Type className="w-4 h-4 mr-2" />
          Agregar Texto
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Imagen</h3>
        <Button className="w-full justify-start" variant="outline" disabled>
          <ImageIcon className="w-4 h-4 mr-2" />
          Agregar Imagen
        </Button>
        <p className="text-xs text-gray-500 mt-1">Próximamente</p>
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
      <div className="text-center text-gray-500 py-8">
        Selecciona un elemento para editarlo
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Acciones</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDuplicate(element.id)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Duplicar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(element.id)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Eliminar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(element.id, { visible: !element.visible })}
          >
            {element.visible ? (
              <Eye className="w-4 h-4 mr-1" />
            ) : (
              <EyeOff className="w-4 h-4 mr-1" />
            )}
            {element.visible ? "Ocultar" : "Mostrar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(element.id, { locked: !element.locked })}
          >
            {element.locked ? (
              <Lock className="w-4 h-4 mr-1" />
            ) : (
              <Unlock className="w-4 h-4 mr-1" />
            )}
            {element.locked ? "Bloqueado" : "Desbloquear"}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Capas</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBringToFront(element.id)}
          >
            <ArrowUp className="w-4 h-4 mr-1" />
            Al frente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSendToBack(element.id)}
          >
            <ArrowDown className="w-4 h-4 mr-1" />
            Atrás
          </Button>
        </div>
      </div>

      {element.type === "uniform" && (
        <>
          <div>
            <Select
              label="Talla"
              value={element.size}
              onChange={e => handleSizeChange(e.target.value as Size)}
              options={sizes.map(s => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Base
            </label>
            <input
              type="color"
              value={element.baseColor}
              onChange={e =>
                onUpdate(element.id, { baseColor: e.target.value })
              }
              className="w-full h-10 rounded border border-gray-300"
            />
          </div>
        </>
      )}

      {element.type === "text" && (
        <>
          <div>
            <Input
              label="Texto"
              value={element.content}
              onChange={e => onUpdate(element.id, { content: e.target.value })}
            />
          </div>
          <div>
            <Input
              label="Tamaño"
              type="number"
              value={element.fontSize}
              onChange={e =>
                onUpdate(element.id, { fontSize: Number(e.target.value) })
              }
              min={10}
              max={200}
            />
          </div>
          <div>
            <Select
              label="Fuente"
              value={element.fontFamily}
              onChange={e =>
                onUpdate(element.id, { fontFamily: e.target.value })
              }
              options={[
                { value: "Arial", label: "Arial" },
                { value: "Helvetica", label: "Helvetica" },
                { value: "Times New Roman", label: "Times New Roman" },
                { value: "Courier", label: "Courier" },
                { value: "Verdana", label: "Verdana" },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <input
              type="color"
              value={element.fontColor}
              onChange={e =>
                onUpdate(element.id, { fontColor: e.target.value })
              }
              className="w-full h-10 rounded border border-gray-300"
            />
          </div>
          <div>
            <Select
              label="Alineación"
              value={element.textAlign}
              onChange={e =>
                onUpdate(element.id, {
                  textAlign: e.target.value as "left" | "center" | "right",
                })
              }
              options={[
                { value: "left", label: "Izquierda" },
                { value: "center", label: "Centro" },
                { value: "right", label: "Derecha" },
              ]}
            />
          </div>
          <div>
            <Select
              label="Peso"
              value={element.fontWeight}
              onChange={e =>
                onUpdate(element.id, {
                  fontWeight: e.target.value as "normal" | "bold",
                })
              }
              options={[
                { value: "normal", label: "Normal" },
                { value: "bold", label: "Negrita" },
              ]}
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rotación: {element.rotation}°
        </label>
        <input
          type="range"
          min="0"
          max="360"
          value={element.rotation}
          onChange={e =>
            onUpdate(element.id, { rotation: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>
    </div>
  );
};
