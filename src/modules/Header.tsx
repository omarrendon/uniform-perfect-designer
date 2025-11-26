import React, { useState } from "react";
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
} from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import { exportCanvas } from "../utils/export";
import { Button } from "../components/Button";
import { ExportLoadingOverlay } from "../components/ExportLoadingOverlay";
import { optimizeLayoutAdvanced, calculateLayoutMetrics, type LayoutOptions } from "../utils/binPacking";

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
  } = useDesignerStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [layoutMetrics, setLayoutMetrics] = useState<{ efficiency: number; wastedSpace: number; overlap: boolean } | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<Partial<LayoutOptions>>({
    elementGap: 5,
    canvasMargin: 0,
    canvasMarginV: 0,
    allowRotation: false,
    sortStrategy: 'area',
    heuristic: 'BSSF',
  });

  const handleExport = async (format: "png" | "pdf") => {
    setShowExportModal(false);

    try {
      if (format === "pdf") {
        // Mostrar loading
        setIsExporting(true);

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
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(canvasElement as HTMLElement, {
              backgroundColor: '#ffffff',
              pixelRatio: 4, // Mayor resolución para mantener calidad de los moldes
            });
            pageImages.push(dataUrl);
          }
        }

        // Restaurar la página original
        setCurrentPage(originalPage);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Crear PDFs separados para cada página
        if (pageImages.length > 0) {
          const { default: jsPDF } = await import('jspdf');
          const { getPageHeight } = useDesignerStore.getState();

          const canvasWidthCm = canvasConfig.width;
          const timestamp = Date.now();

          // Crear un PDF separado para cada página
          for (let i = 0; i < pageImages.length; i++) {
            // Obtener altura ajustada para cada página
            const pageHeightCm = getPageHeight(i);

            const pdf = new jsPDF({
              orientation: canvasWidthCm > pageHeightCm ? 'landscape' : 'portrait',
              unit: 'cm',
              format: [canvasWidthCm, pageHeightCm],
            });

            // Agregar la imagen a este PDF (PNG para mayor calidad)
            // La imagen debe recortarse a la altura real de la página
            pdf.addImage(pageImages[i], 'PNG', 0, 0, canvasWidthCm, pageHeightCm);

            // Guardar con nombre único (incluye número de página si hay más de una)
            const fileName = pageImages.length > 1
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

  const handleOptimizeLayout = () => {
    // Calcular métricas actuales antes de optimizar
    const currentMetrics = calculateLayoutMetrics(elements, canvasConfig);
    setLayoutMetrics(currentMetrics);
    setShowOptimizeModal(true);
  };

  const applyOptimization = () => {
    const result = optimizeLayoutAdvanced(elements, canvasConfig, layoutOptions);

    // Si el resultado tiene múltiples páginas, crear las páginas necesarias
    const { addPage, pages } = useDesignerStore.getState();

    // Crear páginas adicionales si es necesario
    while (pages.length < result.pagesUsed) {
      addPage();
    }

    // Limpiar todos los elementos actuales de todas las páginas
    // y agregar los optimizados
    result.pages.forEach((pageElements) => {
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

    alert(`Optimización completada!\n\nEficiencia: ${result.efficiency.toFixed(1)}%\nPáginas utilizadas: ${result.pagesUsed}\nElementos procesados: ${result.totalElements}`);
    setShowOptimizeModal(false);
  };

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100vw',
          margin: 0,
          zIndex: 100,
          minHeight: '64px',
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Logo y Título */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 'fit-content',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#3b82f6',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: 'white',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            U
          </div>
          <h1 style={{
            fontSize: 'clamp(16px, 4vw, 20px)',
            fontWeight: '700',
            color: 'white',
            letterSpacing: '-0.025em',
            whiteSpace: 'nowrap',
          }}>
            Uniform Designer
          </h1>
        </div>

        {/* Barra de herramientas central */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#374151',
          padding: '6px',
          borderRadius: '8px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {/* Undo/Redo */}
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer (Ctrl+Z)"
            style={{
              color: !canUndo() ? '#6b7280' : '#e5e7eb',
              backgroundColor: 'transparent',
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
              color: !canRedo() ? '#6b7280' : '#e5e7eb',
              backgroundColor: 'transparent',
            }}
          >
            <Redo className="w-4 h-4" />
          </Button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#4b5563', margin: '0 4px' }} />

          {/* Zoom Controls */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom - 0.1)}
            disabled={zoom <= 0.1}
            title="Alejar"
            style={{
              color: zoom <= 0.1 ? '#6b7280' : '#e5e7eb',
              backgroundColor: 'transparent',
            }}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#e5e7eb',
            minWidth: '52px',
            textAlign: 'center',
            backgroundColor: '#1f2937',
            padding: '4px 8px',
            borderRadius: '4px',
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(zoom + 0.1)}
            disabled={zoom >= 3}
            title="Acercar"
            style={{
              color: zoom >= 3 ? '#6b7280' : '#e5e7eb',
              backgroundColor: 'transparent',
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
              color: '#e5e7eb',
              backgroundColor: 'transparent',
            }}
          >
            <Maximize className="w-4 h-4" />
          </Button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#4b5563', margin: '0 4px' }} />

          {/* Optimize Layout */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOptimizeLayout}
            title="Optimizar disposición"
            style={{
              color: '#e5e7eb',
              backgroundColor: 'transparent',
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Acciones principales */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 'fit-content',
          flexWrap: 'wrap',
          marginRight: '72px',
        }}>
          <Button
            size="sm"
            onClick={() => setShowSaveModal(true)}
            style={{
              backgroundColor: '#374151',
              color: 'white',
              border: '1px solid #4b5563',
              padding: '8px 16px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
              fontSize: 'clamp(12px, 2vw, 14px)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4b5563';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
            }}
          >
            <Save style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span style={{ display: 'inline' }}>Guardar</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowExportModal(true)}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: 'clamp(12px, 2vw, 14px)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
            }}
          >
            <Download style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span style={{ display: 'inline' }}>Exportar</span>
          </Button>
        </div>
      </header>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Exportar Diseño</h2>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => handleExport("png")}
                variant="outline"
              >
                Exportar como PNG
              </Button>
              <Button
                className="w-full"
                onClick={() => handleExport("pdf")}
                variant="outline"
              >
                Exportar como PDF
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setShowExportModal(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Estado actual</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Eficiencia:</span>
                    <span className={`ml-2 font-medium ${layoutMetrics.efficiency > 70 ? 'text-green-600' : layoutMetrics.efficiency > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {layoutMetrics.efficiency.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Superposición:</span>
                    <span className={`ml-2 font-medium ${layoutMetrics.overlap ? 'text-red-600' : 'text-green-600'}`}>
                      {layoutMetrics.overlap ? 'Sí' : 'No'}
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
                  onChange={e => setLayoutOptions({ ...layoutOptions, sortStrategy: e.target.value as LayoutOptions['sortStrategy'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="area">Por área (mayor a menor)</option>
                  <option value="height">Por altura (mayor a menor)</option>
                  <option value="width">Por ancho (mayor a menor)</option>
                  <option value="perimeter">Por perímetro (mayor a menor)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heurística de colocación
                </label>
                <select
                  value={layoutOptions.heuristic}
                  onChange={e => setLayoutOptions({ ...layoutOptions, heuristic: e.target.value as LayoutOptions['heuristic'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="BSSF">Best Short Side Fit (recomendado)</option>
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
                    onChange={e => setLayoutOptions({ ...layoutOptions, elementGap: Number(e.target.value) })}
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
                    onChange={e => setLayoutOptions({ ...layoutOptions, canvasMargin: Number(e.target.value) })}
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
                  onChange={e => setLayoutOptions({ ...layoutOptions, allowRotation: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="allowRotation" className="ml-2 text-sm text-gray-700">
                  Permitir rotación de elementos (90°)
                </label>
              </div>
            </div>

            {/* Descripción del algoritmo */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Algoritmo MaxRects:</strong> Utiliza un algoritmo avanzado de bin-packing que mantiene una lista de espacios libres máximos para optimizar el aprovechamiento del espacio. Eficiencia típica: 80-95%.
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
    </>
  );
};
