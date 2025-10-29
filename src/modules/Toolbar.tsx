import React, { useState } from "react";
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
} from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import type { Size, TextElement, UniformTemplate } from "../types";
import { generateId } from "../utils/canvas";
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
  } = useDesignerStore();

  const [activeTab, setActiveTab] = useState<"add" | "edit">("add");

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const handleAddUniform = (part: "jersey" | "shorts") => {
    const sizeConfig = sizeConfigs[2]; // Default M
    const newUniform: UniformTemplate = {
      id: generateId("uniform"),
      type: "uniform",
      part,
      size: sizeConfig.size,
      position: { x: 50, y: 50 },
      dimensions: {
        width: sizeConfig.width * 2,
        height: sizeConfig.height * 2,
      },
      rotation: 0,
      zIndex: elements.length,
      locked: false,
      visible: true,
      baseColor: "#3b82f6",
    };

    addElement(newUniform);
  };

  const handleAddText = () => {
    const newText: TextElement = {
      id: generateId("text"),
      type: "text",
      part: "jersey",
      size: "M",
      position: { x: 100, y: 100 },
      dimensions: { width: 200, height: 50 },
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
          <AddTab onAddUniform={handleAddUniform} onAddText={handleAddText} />
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
}> = ({ onAddUniform, onAddText }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Uniformes</h3>
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onAddUniform("jersey")}
          >
            <Shirt className="w-4 h-4 mr-2" />
            Agregar Playera
          </Button>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onAddUniform("shorts")}
          >
            <Shirt className="w-4 h-4 mr-2" />
            Agregar Short
          </Button>
        </div>
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
  element: UniformTemplate | TextElement | null;
  onUpdate: (
    id: string,
    updates: Partial<UniformTemplate | TextElement>
  ) => void;
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
  if (!element) {
    return (
      <div className="text-center text-gray-500 py-8">
        Selecciona un elemento para editarlo
      </div>
    );
  }

  const sizes: Size[] = ["XS", "S", "M", "L", "XL"];

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
              onChange={e =>
                onUpdate(element.id, { size: e.target.value as Size })
              }
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
