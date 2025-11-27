import React, { useState, useRef, useEffect } from "react";
import {
  Undo,
  Redo,
  Download,
  Save,
  // Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
  Shirt,
  Plus,
  Type,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Edit3,
} from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import { exportCanvas } from "../utils/export";
import { Button } from "../components/Button";
import { ExportLoadingOverlay } from "../components/ExportLoadingOverlay";
import { UniformSizesModal } from "../components/UniformSizesModal";
import {
  optimizeLayoutAdvanced,
  calculateLayoutMetrics,
  type LayoutOptions,
} from "../utils/binPacking";
import {
  generateId,
  findValidPosition,
  hasSpaceForElement,
} from "../utils/canvas";
import type { UniformTemplate, TextElement } from "../types";

export const Header: React.FC = () => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    saveProject,
    elements,
    // setCanvasConfig,
    canvasConfig,
    getTotalPages,
    currentPage,
    setCurrentPage,
    selectedElementId,
    addElement,
    deleteElement,
    duplicateElement,
    updateElement,
    bringToFront,
    sendToBack,
    sizeConfigs,
  } = useDesignerStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [showSizesModal, setShowSizesModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [layoutMetrics, setLayoutMetrics] = useState<{
    efficiency: number;
    wastedSpace: number;
    overlap: boolean;
  } | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<Partial<LayoutOptions>>({
    elementGap: 5,
    canvasMargin: 0,
    canvasMarginV: 0,
    allowRotation: false,
    sortStrategy: "area",
    heuristic: "BSSF",
  });

  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const optimizeDropdownRef = useRef<HTMLDivElement>(null);
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const [showOptimizeDropdown, setShowOptimizeDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showEditDropdown, setShowEditDropdown] = useState(false);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExportModal(false);
      }
      if (
        optimizeDropdownRef.current &&
        !optimizeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowOptimizeDropdown(false);
      }
      if (
        saveDropdownRef.current &&
        !saveDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSaveDropdown(false);
      }
      if (
        addDropdownRef.current &&
        !addDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAddDropdown(false);
      }
      if (
        editDropdownRef.current &&
        !editDropdownRef.current.contains(event.target as Node)
      ) {
        setShowEditDropdown(false);
      }
    };

    if (
      showExportModal ||
      showOptimizeDropdown ||
      showSaveDropdown ||
      showAddDropdown ||
      showEditDropdown
    ) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showExportModal,
    showOptimizeDropdown,
    showSaveDropdown,
    showAddDropdown,
    showEditDropdown,
  ]);

  const handleExport = async (format: "png" | "pdf") => {
    setShowExportModal(false);

    try {
      if (format === "pdf") {
        // Mostrar loading
        setIsExporting(true);

        // CRÍTICO: Intercambiar temporalmente las imágenes comprimidas por las originales
        // para que el PDF tenga alta calidad
        const {
          pages: allPages,
          uniformSizesConfig: originalImages,
          uniformSizesConfigCompressed: compressedImages,
        } = useDesignerStore.getState();

        // Crear un mapeo de URLs comprimidas a originales
        const urlMapping: Map<string, string> = new Map();

        for (const tallaKey of Object.keys(originalImages)) {
          const orig = originalImages[tallaKey];
          const comp = compressedImages[tallaKey];

          if (orig && comp) {
            if (orig.jerseyFront && comp.jerseyFront) {
              urlMapping.set(comp.jerseyFront, orig.jerseyFront);
            }
            if (orig.jerseyBack && comp.jerseyBack) {
              urlMapping.set(comp.jerseyBack, orig.jerseyBack);
            }
            if (orig.shorts && comp.shorts) {
              urlMapping.set(comp.shorts, orig.shorts);
            }
          }
        }

        // Intercambiar URLs en todos los elementos de todas las páginas
        const modifiedPages = allPages.map(page =>
          page.map(element => {
            if (element.type === "uniform" && element.imageUrl) {
              const originalUrl = urlMapping.get(element.imageUrl);
              if (originalUrl) {
                return { ...element, imageUrl: originalUrl };
              }
            }
            return element;
          })
        );

        // Actualizar el store con las URLs originales
        useDesignerStore.setState({ pages: modifiedPages });

        // Exportación PDF multipágina
        const totalPages = getTotalPages();
        const originalPage = currentPage;

        setExportProgress({ current: 0, total: totalPages });

        // Array para almacenar las imágenes de cada página
        const pageImages: string[] = [];

        // Capturar cada página como imagen
        for (let i = 0; i < totalPages; i++) {
          // Actualizar progreso
          setExportProgress({ current: i + 1, total: totalPages });

          // Cambiar a la página i
          setCurrentPage(i);

          // Esperar a que React actualice el DOM y se renderice la página
          await new Promise(resolve => setTimeout(resolve, 500));

          // Obtener el canvas actual
          const canvasElement = document.querySelector(".konvajs-content");
          if (canvasElement) {
            // Convertir directamente a imagen sin clonar
            // Usar PNG para mayor calidad y pixelRatio alto para mejor resolución
            const { toPng } = await import("html-to-image");
            const dataUrl = await toPng(canvasElement as HTMLElement, {
              backgroundColor: "#ffffff",
              pixelRatio: 4, // Mayor resolución para mantener calidad de los moldes
            });
            pageImages.push(dataUrl);
          }
        }

        // Restaurar la página original
        setCurrentPage(originalPage);
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRÍTICO: Restaurar las URLs comprimidas en el store (volver al estado original)
        useDesignerStore.setState({ pages: allPages });

        // Crear PDFs separados para cada página
        if (pageImages.length > 0) {
          const { default: jsPDF } = await import("jspdf");
          const { getPageHeight } = useDesignerStore.getState();

          const canvasWidthCm = canvasConfig.width;
          const timestamp = Date.now();

          // Crear un PDF separado para cada página
          for (let i = 0; i < pageImages.length; i++) {
            // Obtener altura ajustada para cada página
            const pageHeightCm = getPageHeight(i);

            const pdf = new jsPDF({
              orientation:
                canvasWidthCm > pageHeightCm ? "landscape" : "portrait",
              unit: "cm",
              format: [canvasWidthCm, pageHeightCm],
            });

            // Agregar la imagen a este PDF (PNG para mayor calidad)
            // La imagen debe recortarse a la altura real de la página
            pdf.addImage(
              pageImages[i],
              "PNG",
              0,
              0,
              canvasWidthCm,
              pageHeightCm
            );

            // Guardar con nombre único (incluye número de página si hay más de una)
            const fileName =
              pageImages.length > 1
                ? `uniform-design-page-${i + 1}-${timestamp}.pdf`
                : `uniform-design-${timestamp}.pdf`;

            pdf.save(fileName);

            // Pequeña pausa entre descargas para que el navegador procese cada archivo
            if (i < pageImages.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }

        // Ocultar loading
        setIsExporting(false);
        setExportProgress({ current: 0, total: 0 });
      } else {
        // Exportación PNG (solo página actual)
        setIsExporting(true);

        const canvasElement = document.querySelector(".konvajs-content");
        if (canvasElement) {
          await exportCanvas(canvasElement as HTMLElement, {
            format,
            transparent: true,
            canvasWidth: canvasConfig.width,
            canvasHeight: canvasConfig.height,
          });
        }

        setIsExporting(false);
      }
    } catch (error) {
      console.error("Error al exportar:", error);

      // CRÍTICO: En caso de error, también restaurar las URLs comprimidas
      if (format === "pdf") {
        const { pages: originalPages } = useDesignerStore.getState();
        // Intentar restaurar si había un swap de URLs previo
        try {
          // Aquí simplemente forzamos una recarga del estado
          useDesignerStore.setState({ pages: originalPages });
        } catch (restoreError) {
          console.error("Error al restaurar URLs:", restoreError);
        }
      }

      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
      alert("Error al exportar el diseño");
    }
  };

  const handleSave = () => {
    if (projectName.trim()) {
      saveProject(projectName);
      setShowSaveModal(false);
      setProjectName("");
      alert("Proyecto guardado exitosamente");
    }
  };

  // Funciones para agregar elementos
  const handleAddUniform = (part: "jersey" | "shorts") => {
    const sizeConfig = sizeConfigs[2]; // Default M

    const dimensions =
      part === "shorts"
        ? {
            width: sizeConfig.width * 0.45,
            height: sizeConfig.height * 2.2,
          }
        : {
            width: sizeConfig.width,
            height: sizeConfig.height,
          };

    const validPosition = findValidPosition(dimensions, elements, canvasConfig);

    const newUniform: UniformTemplate = {
      id: generateId("uniform"),
      type: "uniform",
      part,
      size: sizeConfig.size,
      position: validPosition,
      dimensions,
      rotation: 0,
      zIndex: elements.length,
      locked: false,
      visible: true,
      baseColor: "#3b82f6",
      imageUrl:
        part === "shorts"
          ? "/moldes/shorts-moldes.png"
          : "/moldes/PLAYERA TALLA M.png",
    };

    addElement(newUniform);
    setShowAddDropdown(false);
  };

  const handleAddText = () => {
    const dimensions = { width: 200, height: 50 };
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
    setShowAddDropdown(false);
  };

  // Verificar si hay espacio para agregar nuevos uniformes
  const sizeConfig = sizeConfigs[2]; // Default M
  const jerseyDimensions = {
    width: sizeConfig.width,
    height: sizeConfig.height,
  };
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

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // const handleOptimizeLayout = () => {
  //   // Calcular métricas actuales antes de optimizar
  //   const currentMetrics = calculateLayoutMetrics(elements, canvasConfig);
  //   setLayoutMetrics(currentMetrics);
  //   setShowOptimizeModal(true);
  // };

  const applyOptimization = () => {
    const result = optimizeLayoutAdvanced(
      elements,
      canvasConfig,
      layoutOptions
    );

    // Si el resultado tiene múltiples páginas, crear las páginas necesarias
    const { addPage, pages } = useDesignerStore.getState();

    // Crear páginas adicionales si es necesario
    while (pages.length < result.pagesUsed) {
      addPage();
    }

    // Limpiar todos los elementos actuales de todas las páginas
    // y agregar los optimizados
    result.pages.forEach(pageElements => {
      pageElements.forEach(el => {
        useDesignerStore.getState().updateElement(el.id, {
          position: el.position,
          dimensions: el.dimensions,
          rotation: el.rotation,
        });
      });
    });

    // Actualizar elementos de la página actual
    const optimized = result.pages[0] || [];
    optimized.forEach(el => {
      useDesignerStore.getState().updateElement(el.id, {
        position: el.position,
        dimensions: el.dimensions,
        rotation: el.rotation,
      });
    });

    // Mostrar resultados
    const newMetrics = calculateLayoutMetrics(optimized, canvasConfig);
    setLayoutMetrics(newMetrics);

    alert(
      `Optimización completada!\n\nEficiencia: ${result.efficiency.toFixed(
        1
      )}%\nPáginas utilizadas: ${result.pagesUsed}\nElementos procesados: ${
        result.totalElements
      }`
    );
    setShowOptimizeModal(false);
  };

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100vw",
          margin: 0,
          zIndex: 100,
          minHeight: "64px",
          backgroundColor: "#1f2937",
          borderBottom: "1px solid #374151",
          borderRadius: "0 0 12px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Logo y Título */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: "fit-content",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#3b82f6",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              color: "white",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            U
          </div>
          <h1
            style={{
              fontSize: "clamp(16px, 4vw, 20px)",
              fontWeight: "700",
              color: "white",
              letterSpacing: "-0.025em",
              whiteSpace: "nowrap",
            }}
          >
            Uniform Designer
          </h1>
        </div>

        {/* Barra de herramientas central */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "#374151",
            padding: "6px",
            borderRadius: "8px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* Undo/Redo */}
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer (Ctrl+Z)"
            style={{
              color: !canUndo() ? "#6b7280" : "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={redo}
            disabled={!canRedo()}
            title="Rehacer (Ctrl+Y)"
            style={{
              color: !canRedo() ? "#6b7280" : "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <Redo className="w-4 h-4" />
          </Button>

          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: "#4b5563",
              margin: "0 4px",
            }}
          />

          {/* Zoom Controls */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom - 0.1)}
            disabled={zoom <= 0.1}
            title="Alejar"
            style={{
              color: zoom <= 0.1 ? "#6b7280" : "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#e5e7eb",
              minWidth: "52px",
              textAlign: "center",
              backgroundColor: "#1f2937",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom + 0.1)}
            disabled={zoom >= 3}
            title="Acercar"
            style={{
              color: zoom >= 3 ? "#6b7280" : "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(1)}
            title="Restablecer Zoom (100%)"
            style={{
              color: "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <Maximize className="w-4 h-4" />
          </Button>

          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: "#4b5563",
              margin: "0 4px",
            }}
          />

          {/* Optimize Layout Dropdown */}
          <div ref={optimizeDropdownRef} style={{ position: "relative" }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!showOptimizeDropdown) {
                  // Calcular métricas al abrir el dropdown
                  const currentMetrics = calculateLayoutMetrics(
                    elements,
                    canvasConfig
                  );
                  setLayoutMetrics(currentMetrics);
                }
                setShowOptimizeDropdown(!showOptimizeDropdown);
              }}
              title="Optimizar disposición"
              style={{
                color: "#e5e7eb",
                backgroundColor: showOptimizeDropdown
                  ? "#374151"
                  : "transparent",
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>

            {/* Optimize Dropdown Menu */}
            {showOptimizeDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#1f2937",
                  borderRadius: "8px",
                  padding: "12px",
                  minWidth: "320px",
                  maxWidth: "380px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
                  border: "1px solid #374151",
                  zIndex: 1000,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#f9fafb",
                    marginBottom: "12px",
                  }}
                >
                  Optimizar Disposición
                </h3>

                {/* Metrics Display */}
                {layoutMetrics && (
                  <div
                    style={{
                      backgroundColor: "#374151",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <span style={{ color: "#9ca3af" }}>Eficiencia: </span>
                        <span
                          style={{
                            fontWeight: "600",
                            color:
                              layoutMetrics.efficiency > 70
                                ? "#10b981"
                                : layoutMetrics.efficiency > 50
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        >
                          {layoutMetrics.efficiency.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#9ca3af" }}>
                          Superposición:{" "}
                        </span>
                        <span
                          style={{
                            fontWeight: "600",
                            color: layoutMetrics.overlap
                              ? "#ef4444"
                              : "#10b981",
                          }}
                        >
                          {layoutMetrics.overlap ? "Sí" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strategy Selection */}
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#e5e7eb",
                      marginBottom: "6px",
                    }}
                  >
                    Estrategia
                  </label>
                  <select
                    value={layoutOptions.sortStrategy}
                    onChange={e =>
                      setLayoutOptions({
                        ...layoutOptions,
                        sortStrategy: e.target
                          .value as LayoutOptions["sortStrategy"],
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      backgroundColor: "#374151",
                      color: "#e5e7eb",
                      border: "1px solid #4b5563",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="area">Por área</option>
                    <option value="height">Por altura</option>
                    <option value="width">Por ancho</option>
                    <option value="perimeter">Por perímetro</option>
                  </select>
                </div>

                {/* Heuristic Selection */}
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#e5e7eb",
                      marginBottom: "6px",
                    }}
                  >
                    Heurística
                  </label>
                  <select
                    value={layoutOptions.heuristic}
                    onChange={e =>
                      setLayoutOptions({
                        ...layoutOptions,
                        heuristic: e.target.value as LayoutOptions["heuristic"],
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      backgroundColor: "#374151",
                      color: "#e5e7eb",
                      border: "1px solid #4b5563",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="BSSF">Best Short Side Fit</option>
                    <option value="BLSF">Best Long Side Fit</option>
                    <option value="BAF">Best Area Fit</option>
                    <option value="BL">Bottom-Left</option>
                  </select>
                </div>

                {/* Gap and Margin Inputs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#e5e7eb",
                        marginBottom: "6px",
                      }}
                    >
                      Separación (px)
                    </label>
                    <input
                      type="number"
                      value={layoutOptions.elementGap}
                      onChange={e =>
                        setLayoutOptions({
                          ...layoutOptions,
                          elementGap: Number(e.target.value),
                        })
                      }
                      min={0}
                      max={50}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        backgroundColor: "#374151",
                        color: "#e5e7eb",
                        border: "1px solid #4b5563",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#e5e7eb",
                        marginBottom: "6px",
                      }}
                    >
                      Margen (px)
                    </label>
                    <input
                      type="number"
                      value={layoutOptions.canvasMargin}
                      onChange={e =>
                        setLayoutOptions({
                          ...layoutOptions,
                          canvasMargin: Number(e.target.value),
                        })
                      }
                      min={0}
                      max={100}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        backgroundColor: "#374151",
                        color: "#e5e7eb",
                        border: "1px solid #4b5563",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>

                {/* Rotation Checkbox */}
                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={layoutOptions.allowRotation}
                      onChange={e =>
                        setLayoutOptions({
                          ...layoutOptions,
                          allowRotation: e.target.checked,
                        })
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    Permitir rotación (90°)
                  </label>
                </div>

                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#374151",
                    margin: "10px 0",
                  }}
                />

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      const currentMetrics = calculateLayoutMetrics(
                        elements,
                        canvasConfig
                      );
                      setLayoutMetrics(currentMetrics);
                      applyOptimization();
                      setShowOptimizeDropdown(false);
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#2563eb";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = "#3b82f6";
                    }}
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => setShowOptimizeDropdown(false)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      border: "1px solid #4b5563",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#374151";
                      e.currentTarget.style.color = "#e5e7eb";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#9ca3af";
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: "#4b5563",
              margin: "0 4px",
            }}
          />

          {/* Botón Agregar con Dropdown */}
          <div ref={addDropdownRef} style={{ position: "relative" }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              title="Agregar elementos"
              style={{
                color: "#e5e7eb",
                backgroundColor: showAddDropdown ? "#374151" : "transparent",
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>

            {/* Add Dropdown Menu */}
            {showAddDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#1f2937",
                  borderRadius: "8px",
                  padding: "8px",
                  minWidth: "200px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
                  border: "1px solid #374151",
                  zIndex: 1000,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                <button
                  onClick={() => handleAddUniform("jersey")}
                  disabled={!canAddJersey}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: canAddJersey ? "#e5e7eb" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: canAddJersey ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    if (canAddJersey) {
                      e.currentTarget.style.backgroundColor = "#374151";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Shirt
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Agregar Playera
                </button>
                <button
                  onClick={() => handleAddUniform("shorts")}
                  disabled={!canAddShorts}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: canAddShorts ? "#e5e7eb" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: canAddShorts ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    if (canAddShorts) {
                      e.currentTarget.style.backgroundColor = "#374151";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Shirt
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Agregar Short
                </button>
                <button
                  onClick={() => handleAddText()}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Type
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Agregar Texto
                </button>
              </div>
            )}
          </div>

          {/* Botón Editar con Dropdown */}
          <div ref={editDropdownRef} style={{ position: "relative" }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEditDropdown(!showEditDropdown)}
              title="Editar elemento seleccionado"
              disabled={!selectedElement}
              style={{
                color: selectedElement ? "#e5e7eb" : "#6b7280",
                backgroundColor: showEditDropdown ? "#374151" : "transparent",
                cursor: selectedElement ? "pointer" : "not-allowed",
              }}
            >
              <Edit3 className="w-4 h-4" />
            </Button>

            {/* Edit Dropdown Menu */}
            {showEditDropdown && selectedElement && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#1f2937",
                  borderRadius: "8px",
                  padding: "8px",
                  minWidth: "200px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
                  border: "1px solid #374151",
                  zIndex: 1000,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                <button
                  onClick={() => {
                    duplicateElement(selectedElement.id);
                    setShowEditDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Copy
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Duplicar
                </button>
                <button
                  onClick={() => {
                    deleteElement(selectedElement.id);
                    setShowEditDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#ef4444",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Trash2
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Eliminar
                </button>
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#374151",
                    margin: "6px 0",
                  }}
                />
                <button
                  onClick={() => {
                    updateElement(selectedElement.id, {
                      visible: !selectedElement.visible,
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {selectedElement.visible ? (
                    <>
                      <Eye
                        style={{ width: "16px", height: "16px", flexShrink: 0 }}
                      />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <EyeOff
                        style={{ width: "16px", height: "16px", flexShrink: 0 }}
                      />
                      Mostrar
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    updateElement(selectedElement.id, {
                      locked: !selectedElement.locked,
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {selectedElement.locked ? (
                    <>
                      <Lock
                        style={{ width: "16px", height: "16px", flexShrink: 0 }}
                      />
                      Desbloquear
                    </>
                  ) : (
                    <>
                      <Unlock
                        style={{ width: "16px", height: "16px", flexShrink: 0 }}
                      />
                      Bloquear
                    </>
                  )}
                </button>
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#374151",
                    margin: "6px 0",
                  }}
                />
                <button
                  onClick={() => {
                    bringToFront(selectedElement.id);
                    setShowEditDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <ArrowUp
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Traer al frente
                </button>
                <button
                  onClick={() => {
                    sendToBack(selectedElement.id);
                    setShowEditDropdown(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <ArrowDown
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Enviar atrás
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: "#4b5563",
              margin: "0 4px",
            }}
          />

          {/* Configuración de Tallas */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSizesModal(true)}
            title="Configurar Tallas de Uniformes"
            style={{
              color: "#e5e7eb",
              backgroundColor: "transparent",
            }}
          >
            <Shirt className="w-4 h-4" />
          </Button>
        </div>

        {/* Acciones principales */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "fit-content",
            flexWrap: "wrap",
            marginRight: "72px",
            position: "relative",
          }}
        >
          <div ref={saveDropdownRef} style={{ position: "relative" }}>
            <Button
              size="sm"
              onClick={() => setShowSaveDropdown(!showSaveDropdown)}
              style={{
                backgroundColor: showSaveDropdown ? "#4b5563" : "#374151",
                color: "white",
                border: "1px solid #4b5563",
                padding: "8px 16px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "500",
                fontSize: "clamp(12px, 2vw, 14px)",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#4b5563";
              }}
              onMouseLeave={e => {
                if (!showSaveDropdown) {
                  e.currentTarget.style.backgroundColor = "#374151";
                }
              }}
            >
              <Save style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <span style={{ display: "inline" }}>Guardar</span>
            </Button>

            {/* Save Dropdown Menu */}
            {showSaveDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: "0",
                  backgroundColor: "#1f2937",
                  borderRadius: "8px",
                  padding: "12px",
                  minWidth: "280px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
                  border: "1px solid #374151",
                  zIndex: 1000,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#f9fafb",
                    marginBottom: "12px",
                  }}
                >
                  Guardar Proyecto
                </h3>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#e5e7eb",
                      marginBottom: "6px",
                    }}
                  >
                    Nombre del proyecto
                  </label>
                  <input
                    type="text"
                    placeholder="Mi diseño de uniformes"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && projectName.trim()) {
                        handleSave();
                        setShowSaveDropdown(false);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      backgroundColor: "#374151",
                      color: "#e5e7eb",
                      border: "1px solid #4b5563",
                      borderRadius: "6px",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    autoFocus
                  />
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      marginTop: "6px",
                    }}
                  >
                    Se guardará en tu navegador localmente
                  </p>
                </div>

                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#374151",
                    margin: "10px 0",
                  }}
                />

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      if (projectName.trim()) {
                        handleSave();
                        setShowSaveDropdown(false);
                      }
                    }}
                    disabled={!projectName.trim()}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      backgroundColor: projectName.trim()
                        ? "#3b82f6"
                        : "#374151",
                      color: projectName.trim() ? "white" : "#6b7280",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: projectName.trim() ? "pointer" : "not-allowed",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      if (projectName.trim()) {
                        e.currentTarget.style.backgroundColor = "#2563eb";
                      }
                    }}
                    onMouseLeave={e => {
                      if (projectName.trim()) {
                        e.currentTarget.style.backgroundColor = "#3b82f6";
                      }
                    }}
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveDropdown(false);
                      setProjectName("");
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      border: "1px solid #4b5563",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#374151";
                      e.currentTarget.style.color = "#e5e7eb";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#9ca3af";
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div ref={exportDropdownRef} style={{ position: "relative" }}>
            <Button
              size="sm"
              onClick={() => setShowExportModal(!showExportModal)}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                padding: "8px 20px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "600",
                fontSize: "clamp(12px, 2vw, 14px)",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#2563eb";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px 0 rgba(0, 0, 0, 0.1)";
              }}
            >
              <Download
                style={{ width: "16px", height: "16px", flexShrink: 0 }}
              />
              <span style={{ display: "inline" }}>Exportar</span>
            </Button>

            {/* Export Dropdown Menu */}
            {showExportModal && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: "0",
                  backgroundColor: "#1f2937",
                  borderRadius: "8px",
                  padding: "8px",
                  minWidth: "220px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
                  border: "1px solid #374151",
                  zIndex: 1000,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                <style>
                  {`
                    @keyframes slideDown {
                      from {
                        opacity: 0;
                        transform: translateY(-10px);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0);
                      }
                    }
                  `}
                </style>
                <button
                  onClick={() => {
                    handleExport("png");
                    setShowExportModal(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Download
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Exportar como PNG
                </button>
                <button
                  onClick={() => {
                    handleExport("pdf");
                    setShowExportModal(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Download
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  Exportar como PDF
                </button>
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#374151",
                    margin: "6px 0",
                  }}
                />
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "center",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "#374151";
                    e.currentTarget.style.color = "#e5e7eb";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#9ca3af";
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Guardar Proyecto</h2>
            <input
              type="text"
              placeholder="Nombre del proyecto"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave}>
                Guardar
              </Button>
              <Button
                className="flex-1"
                variant="ghost"
                onClick={() => {
                  setShowSaveModal(false);
                  setProjectName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Optimize Layout Modal */}
      {showOptimizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[480px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Optimizar Disposición</h2>

            {/* Métricas actuales */}
            {layoutMetrics && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Estado actual
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Eficiencia:</span>
                    <span
                      className={`ml-2 font-medium ${
                        layoutMetrics.efficiency > 70
                          ? "text-green-600"
                          : layoutMetrics.efficiency > 50
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {layoutMetrics.efficiency.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Superposición:</span>
                    <span
                      className={`ml-2 font-medium ${
                        layoutMetrics.overlap
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {layoutMetrics.overlap ? "Sí" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Opciones de configuración */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estrategia de ordenamiento
                </label>
                <select
                  value={layoutOptions.sortStrategy}
                  onChange={e =>
                    setLayoutOptions({
                      ...layoutOptions,
                      sortStrategy: e.target
                        .value as LayoutOptions["sortStrategy"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="area">Por área (mayor a menor)</option>
                  <option value="height">Por altura (mayor a menor)</option>
                  <option value="width">Por ancho (mayor a menor)</option>
                  <option value="perimeter">
                    Por perímetro (mayor a menor)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heurística de colocación
                </label>
                <select
                  value={layoutOptions.heuristic}
                  onChange={e =>
                    setLayoutOptions({
                      ...layoutOptions,
                      heuristic: e.target.value as LayoutOptions["heuristic"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="BSSF">
                    Best Short Side Fit (recomendado)
                  </option>
                  <option value="BLSF">Best Long Side Fit</option>
                  <option value="BAF">Best Area Fit</option>
                  <option value="BL">Bottom-Left</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Separación (px)
                  </label>
                  <input
                    type="number"
                    value={layoutOptions.elementGap}
                    onChange={e =>
                      setLayoutOptions({
                        ...layoutOptions,
                        elementGap: Number(e.target.value),
                      })
                    }
                    min={0}
                    max={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Margen (px)
                  </label>
                  <input
                    type="number"
                    value={layoutOptions.canvasMargin}
                    onChange={e =>
                      setLayoutOptions({
                        ...layoutOptions,
                        canvasMargin: Number(e.target.value),
                      })
                    }
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowRotation"
                  checked={layoutOptions.allowRotation}
                  onChange={e =>
                    setLayoutOptions({
                      ...layoutOptions,
                      allowRotation: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label
                  htmlFor="allowRotation"
                  className="ml-2 text-sm text-gray-700"
                >
                  Permitir rotación de elementos (90°)
                </label>
              </div>
            </div>

            {/* Descripción del algoritmo */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Algoritmo MaxRects:</strong> Utiliza un algoritmo
                avanzado de bin-packing que mantiene una lista de espacios
                libres máximos para optimizar el aprovechamiento del espacio.
                Eficiencia típica: 80-95%.
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <Button className="flex-1" onClick={applyOptimization}>
                Aplicar Optimización
              </Button>
              <Button
                className="flex-1"
                variant="ghost"
                onClick={() => setShowOptimizeModal(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Loading Overlay */}
      <ExportLoadingOverlay
        isVisible={isExporting}
        currentPage={exportProgress.current}
        totalPages={exportProgress.total}
      />

      {/* Uniform Sizes Modal */}
      <UniformSizesModal
        isOpen={showSizesModal}
        onClose={() => setShowSizesModal(false)}
      />
    </>
  );
};
