// import { create } from "zustand";
// import { devtools, persist } from "zustand/middleware";
// import type {
//   CanvasConfig,
//   CanvasElement,
//   HistoryState,
//   Project,
//   Size,
//   SizeConfig,
// } from "../types";

// interface DesignerState {
//   // Canvas configuration
//   canvasConfig: CanvasConfig;
//   setCanvasConfig: (config: Partial<CanvasConfig>) => void;

//   // Elements
//   elements: CanvasElement[];
//   selectedElementId: string | null;
//   addElement: (element: CanvasElement) => void;
//   updateElement: (id: string, updates: Partial<CanvasElement>) => void;
//   deleteElement: (id: string) => void;
//   selectElement: (id: string | null) => void;
//   duplicateElement: (id: string) => void;
//   bringToFront: (id: string) => void;
//   sendToBack: (id: string) => void;

//   // Size configurations
//   sizeConfigs: SizeConfig[];
//   updateSizeConfig: (size: Size, config: Partial<SizeConfig>) => void;

//   // History (Undo/Redo)
//   history: HistoryState[];
//   historyIndex: number;
//   saveHistory: () => void;
//   undo: () => void;
//   redo: () => void;
//   canUndo: () => boolean;
//   canRedo: () => boolean;

//   // Project management
//   currentProject: Project | null;
//   saveProject: (name: string) => void;
//   loadProject: (project: Project) => void;
//   clearProject: () => void;

//   // UI State
//   showGrid: boolean;
//   toggleGrid: () => void;
//   zoom: number;
//   setZoom: (zoom: number) => void;
// }

// const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
//   width: 100, // cm
//   height: 50, // cm
//   pixelsPerCm: 10,
// };

// const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
//   { size: "XS", width: 40, height: 50 },
//   { size: "S", width: 45, height: 55 },
//   { size: "M", width: 50, height: 60 },
//   { size: "L", width: 55, height: 65 },
//   { size: "XL", width: 60, height: 70 },
// ];

// export const useDesignerStore = create<DesignerState>()(
//   devtools(
//     persist(
//       (set, get) => ({
//         // Initial state
//         canvasConfig: DEFAULT_CANVAS_CONFIG,
//         elements: [],
//         selectedElementId: null,
//         sizeConfigs: DEFAULT_SIZE_CONFIGS,
//         history: [],
//         historyIndex: -1,
//         currentProject: null,
//         showGrid: true,
//         zoom: 1,

//         // Canvas configuration
//         setCanvasConfig: config =>
//           set(state => ({
//             canvasConfig: { ...state.canvasConfig, ...config },
//           })),

//         // Element management
//         addElement: element =>
//           set(state => {
//             const newElements = [...state.elements, element];
//             return { elements: newElements };
//           }),

//         updateElement: (id, updates) =>
//           set(state => ({
//             elements: state.elements.map(el =>
//               el.id === id ? ({ ...el, ...updates } as CanvasElement) : el
//             ),
//           })),

//         deleteElement: id =>
//           set(state => ({
//             elements: state.elements.filter(el => el.id !== id),
//             selectedElementId:
//               state.selectedElementId === id ? null : state.selectedElementId,
//           })),

//         selectElement: id =>
//           set(() => ({
//             selectedElementId: id,
//           })),

//         duplicateElement: id =>
//           set(state => {
//             const element = state.elements.find(el => el.id === id);
//             if (!element) return state;

//             const newElement: CanvasElement = {
//               ...element,
//               id: `${element.type}-${Date.now()}`,
//               position: {
//                 x: element.position.x + 20,
//                 y: element.position.y + 20,
//               },
//             };

//             return {
//               elements: [...state.elements, newElement],
//               selectedElementId: newElement.id,
//             };
//           }),

//         bringToFront: id =>
//           set(state => {
//             const maxZIndex = Math.max(...state.elements.map(el => el.zIndex));
//             return {
//               elements: state.elements.map(el =>
//                 el.id === id ? { ...el, zIndex: maxZIndex + 1 } : el
//               ),
//             };
//           }),

//         sendToBack: id =>
//           set(state => {
//             const minZIndex = Math.min(...state.elements.map(el => el.zIndex));
//             return {
//               elements: state.elements.map(el =>
//                 el.id === id ? { ...el, zIndex: minZIndex - 1 } : el
//               ),
//             };
//           }),

//         // Size configurations
//         updateSizeConfig: (size, config) =>
//           set(state => ({
//             sizeConfigs: state.sizeConfigs.map(sc =>
//               sc.size === size ? { ...sc, ...config } : sc
//             ),
//           })),

//         // History management
//         saveHistory: () =>
//           set(state => {
//             const newHistory = state.history.slice(0, state.historyIndex + 1);
//             newHistory.push({
//               elements: [...state.elements],
//               timestamp: Date.now(),
//             });

//             // Limit history to 50 states
//             if (newHistory.length > 50) {
//               newHistory.shift();
//             }

//             return {
//               history: newHistory,
//               historyIndex: newHistory.length - 1,
//             };
//           }),

//         undo: () =>
//           set(state => {
//             if (state.historyIndex <= 0) return state;

//             const newIndex = state.historyIndex - 1;
//             return {
//               elements: [...state.history[newIndex].elements],
//               historyIndex: newIndex,
//             };
//           }),

//         redo: () =>
//           set(state => {
//             if (state.historyIndex >= state.history.length - 1) return state;

//             const newIndex = state.historyIndex + 1;
//             return {
//               elements: [...state.history[newIndex].elements],
//               historyIndex: newIndex,
//             };
//           }),

//         canUndo: () => get().historyIndex > 0,
//         canRedo: () => get().historyIndex < get().history.length - 1,

//         // Project management
//         saveProject: name =>
//           set(state => {
//             const project: Project = {
//               id: `project-${Date.now()}`,
//               name,
//               canvasConfig: state.canvasConfig,
//               elements: state.elements,
//               sizeConfigs: state.sizeConfigs,
//               createdAt: new Date(),
//               updatedAt: new Date(),
//             };

//             localStorage.setItem(project.id, JSON.stringify(project));

//             return { currentProject: project };
//           }),

//         loadProject: project =>
//           set(() => ({
//             canvasConfig: project.canvasConfig,
//             elements: project.elements,
//             sizeConfigs: project.sizeConfigs,
//             currentProject: project,
//             selectedElementId: null,
//           })),

//         clearProject: () =>
//           set(() => ({
//             elements: [],
//             selectedElementId: null,
//             currentProject: null,
//             history: [],
//             historyIndex: -1,
//           })),

//         // UI State
//         toggleGrid: () =>
//           set(state => ({
//             showGrid: !state.showGrid,
//           })),

//         setZoom: zoom =>
//           set(() => ({
//             zoom: Math.max(0.1, Math.min(3, zoom)),
//           })),
//       }),
//       {
//         name: "designer-storage",
//         partialize: state => ({
//           canvasConfig: state.canvasConfig,
//           sizeConfigs: state.sizeConfigs,
//           showGrid: state.showGrid,
//         }),
//       }
//     )
//   )
// );

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
  CanvasConfig,
  CanvasElement,
  Gender,
  HistoryState,
  Project,
  Size,
  SizeConfig,
  SizeImages,
  UniformDesignConfig,
  UniformSizesConfig,
} from "../types";
import { findValidPosition } from "../utils/canvas";

interface DesignerState {
  // Canvas configuration
  canvasConfig: CanvasConfig;
  setCanvasConfig: (config: Partial<CanvasConfig>) => void;

  // Multi-page support
  currentPage: number;
  pages: CanvasElement[][]; // Array de páginas, cada una con sus elementos
  setCurrentPage: (page: number) => void;
  addPage: () => void;
  deletePage: (pageIndex: number) => void;
  getTotalPages: () => number;
  getPageHeight: (pageIndex: number) => number; // Obtener altura ajustada de una página en cm

  // Elements (de la página actual)
  elements: CanvasElement[];
  selectedElementId: string | null;
  addElement: (element: CanvasElement, pageIndex?: number) => void;
  addElementsBatch: (pageElements: Map<number, CanvasElement[]>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  duplicateElement: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Size configurations
  sizeConfigs: SizeConfig[];
  updateSizeConfig: (size: Size, config: Partial<SizeConfig>) => void;

  // Uniform sizes configuration (imágenes por talla)
  uniformSizesConfig: UniformSizesConfig; // Imágenes ORIGINALES (para PDF)
  uniformSizesConfigCompressed: UniformSizesConfig; // Imágenes COMPRIMIDAS (para canvas)
  setUniformSizeImages: (sizeKey: string, images: Partial<SizeImages>) => void; // sizeKey puede ser SizeSpanish o compound key "H-XS", "M-CH"
  getUniformSizeImages: (sizeKey: string) => SizeImages | undefined;
  getUniformSizeImagesCompressed: (sizeKey: string) => SizeImages | undefined;
  isSizeComplete: (sizeKey: string) => boolean;
  clearUniformSizesConfig: () => void;
  getSizeConfig: (size: Size, gender: Gender) => SizeConfig | undefined; // Helper para obtener config por talla y género

  // Uniform template — una sola plantilla para todas las tallas
  uniformTemplate: SizeImages | null; // Imágenes ORIGINALES del template (para PDF)
  uniformTemplateCompressed: SizeImages | null; // Imágenes COMPRIMIDAS del template (para canvas)
  setUniformTemplate: (images: Partial<SizeImages>) => void;
  isTemplateComplete: () => boolean;
  clearUniformTemplate: () => void;

  // Diseño del uniforme (posiciones de textos)
  uniformDesignConfig: UniformDesignConfig | null;
  setUniformDesignConfig: (config: UniformDesignConfig | null) => void;

  // History (Undo/Redo)
  history: HistoryState[];
  historyIndex: number;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Project management
  currentProject: Project | null;
  saveProject: (name: string) => void;
  loadProject: (project: Project) => void;
  clearProject: () => void;

  // UI State
  showGrid: boolean;
  toggleGrid: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isCanvasHidden: boolean;
  setCanvasHidden: (hidden: boolean) => void;
  isExporting: boolean; // Oculta textos de talla durante exportación
  setIsExporting: (isExporting: boolean) => void;

  // Bulk Image Upload
  bulkImageUpload: {
    jerseyFronts: File[];
    jerseyBacks: File[];
    shortsRights: File[];
    shortsLefts: File[];
  };
  setBulkImages: (type: 'jerseyFronts' | 'jerseyBacks' | 'shortsRights' | 'shortsLefts', files: File[]) => void;
  processBulkImages: () => Promise<void>;
  clearBulkImages: () => void;
}

const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 158.529, // cm - ancho máximo para impresión
  height: 490, // cm - alto máximo para impresión
  pixelsPerCm: 10,
};

// Configuraciones de tallas HOMBRE - Medidas reales verificadas
const SIZE_CONFIGS_HOMBRE: SizeConfig[] = [
  {
    size: "XS", gender: "Hombre",
    width: 513.19, height: 714.38,     // Playera: 51.319cm × 71.438cm (medida real verificada)
    shortsWidth: 780.66, shortsHeight: 544.3 // Shorts:  78.066cm × 54.43cm (medida real verificada)
  },
  {
    size: "S", gender: "Hombre",
    width: 540.98, height: 752.76,     // Playera: 54.098cm × 75.276cm (medida real verificada)
    shortsWidth: 821.74, shortsHeight: 572.95 // Shorts:  82.174cm × 57.295cm (medida real verificada)
  },
  {
    size: "M", gender: "Hombre",
    width: 568.63, height: 791.56,     // Playera: 56.863cm × 79.156cm (medida real verificada)
    shortsWidth: 863.6, shortsHeight: 602.38 // Shorts:  86.36cm × 60.238cm (medida real verificada)
  },
  {
    size: "L", gender: "Hombre",
    width: 599.34, height: 834,        // Playera: 59.934cm × 83.4cm (medida real verificada)
    shortsWidth: 906.75, shortsHeight: 632.46 // Shorts:  90.675cm × 63.246cm (medida real verificada)
  },
  {
    size: "XL", gender: "Hombre",
    width: 629.26, height: 875.66,     // Playera: 62.926cm × 87.566cm (medida real verificada)
    shortsWidth: 952.04, shortsHeight: 664.04 // Shorts:  95.204cm × 66.404cm (medida real verificada)
  },
];

// Configuraciones de tallas MUJER - Usando medidas de hombre temporalmente
// TODO: Actualizar con medidas reales de uniformes de mujer
const SIZE_CONFIGS_MUJER: SizeConfig[] = [
  {
    size: "XS", gender: "Mujer",
    width: 513.19, height: 714.38,     // TEMPORAL: usar medidas de hombre
    shortsWidth: 780.66, shortsHeight: 544.3
  },
  {
    size: "S", gender: "Mujer",
    width: 540.98, height: 752.76,     // TEMPORAL: usar medidas de hombre
    shortsWidth: 821.74, shortsHeight: 572.95
  },
  {
    size: "M", gender: "Mujer",
    width: 568.63, height: 791.56,     // TEMPORAL: usar medidas de hombre
    shortsWidth: 863.6, shortsHeight: 602.38
  },
  {
    size: "L", gender: "Mujer",
    width: 599.34, height: 834,        // TEMPORAL: usar medidas de hombre
    shortsWidth: 906.75, shortsHeight: 632.46
  },
  {
    size: "XL", gender: "Mujer",
    width: 629.26, height: 875.66,     // TEMPORAL: usar medidas de hombre
    shortsWidth: 952.04, shortsHeight: 664.04
  },
];

// Combinar todas las configuraciones
const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
  ...SIZE_CONFIGS_HOMBRE,
  ...SIZE_CONFIGS_MUJER,
];

export const useDesignerStore = create<DesignerState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        canvasConfig: DEFAULT_CANVAS_CONFIG,
        currentPage: 0,
        pages: [[]], // Iniciar con una página vacía
        elements: [], // Computed property basado en currentPage
        selectedElementId: null,
        sizeConfigs: DEFAULT_SIZE_CONFIGS,
        uniformSizesConfig: {}, // Configuración de imágenes ORIGINALES por talla
        uniformSizesConfigCompressed: {}, // Configuración de imágenes COMPRIMIDAS por talla
        uniformTemplate: null,
        uniformTemplateCompressed: null,
        uniformDesignConfig: null,
        history: [],
        historyIndex: -1,
        currentProject: null,
        showGrid: true,
        zoom: 1,
        isCanvasHidden: false,
        isExporting: false,

        // Bulk Image Upload initial state
        bulkImageUpload: {
          jerseyFronts: [],
          jerseyBacks: [],
          shortsRights: [],
          shortsLefts: [],
        },

        // Canvas configuration
        setCanvasConfig: config =>
          set(state => ({
            canvasConfig: { ...state.canvasConfig, ...config },
          })),

        // Multi-page management
        setCurrentPage: (page: number) =>
          set(state => {
            const validPage = Math.max(0, Math.min(page, state.pages.length - 1));
            return {
              currentPage: validPage,
              elements: state.pages[validPage] || [],
              selectedElementId: null, // Deseleccionar al cambiar de página
            };
          }),

        addPage: () =>
          set(state => ({
            pages: [...state.pages, []],
          })),

        deletePage: (pageIndex: number) =>
          set(state => {
            if (state.pages.length <= 1) return state; // No eliminar la última página
            const newPages = state.pages.filter((_, i) => i !== pageIndex);
            const newCurrentPage = Math.min(state.currentPage, newPages.length - 1);
            return {
              pages: newPages,
              currentPage: newCurrentPage,
              elements: newPages[newCurrentPage] || [],
            };
          }),

        getTotalPages: () => get().pages.length,

        // Obtener altura ajustada para cada página
        // La altura máxima es state.canvasConfig.height (usa configuración actual, no el default)
        // TODAS las páginas se recortan al tamaño exacto de sus elementos (sin espacio en blanco)
        getPageHeight: (pageIndex: number) => {
          const state = get();
          const maxHeight = state.canvasConfig.height; // USA LA CONFIGURACIÓN ACTUAL, no DEFAULT

          // Obtener elementos de la página
          const pageElements = state.pages[pageIndex] || [];
          if (pageElements.length === 0) {
            return maxHeight; // Si está vacía, mantener altura máxima
          }

          // Encontrar el punto Y más bajo (elemento más abajo en la página)
          let maxY = 0;
          for (const element of pageElements) {
            const elementBottom = element.position.y + element.dimensions.height;
            if (elementBottom > maxY) {
              maxY = elementBottom;
            }
          }

          // Convertir de píxeles a cm (usa pixelsPerCm actual, no el default)
          const heightInCm = maxY / state.canvasConfig.pixelsPerCm;

          // Retornar la altura real usada (sin margen extra)
          // Si es mayor que maxHeight, usar maxHeight
          return Math.min(heightInCm, maxHeight);
        },

        // Element management
        addElement: (element, pageIndex) =>
          set(state => {
            const targetPage = pageIndex !== undefined ? pageIndex : state.currentPage;
            const newPages = [...state.pages];

            // Asegurar que la página existe
            while (newPages.length <= targetPage) {
              newPages.push([]);
            }

            newPages[targetPage] = [...newPages[targetPage], element];

            return {
              pages: newPages,
              elements: targetPage === state.currentPage ? newPages[targetPage] : state.elements,
            };
          }),

        // Agrega múltiples elementos distribuidos en páginas en un solo set() → un solo re-render.
        // pageElements: Map<pageIndex, elementos de esa página>
        addElementsBatch: (pageElements) =>
          set(state => {
            const newPages = [...state.pages];

            pageElements.forEach((els, pageIndex) => {
              while (newPages.length <= pageIndex) newPages.push([]);
              newPages[pageIndex] = [...newPages[pageIndex], ...els];
            });

            return {
              pages: newPages,
              elements: newPages[state.currentPage] ?? [],
            };
          }),

        updateElement: (id, updates) =>
          set(state => {
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? ({ ...el, ...updates } as CanvasElement) : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        deleteElement: id =>
          set(state => {
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.filter(el => el.id !== id);
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
              selectedElementId:
                state.selectedElementId === id ? null : state.selectedElementId,
            };
          }),

        selectElement: id =>
          set(() => ({
            selectedElementId: id,
          })),

        duplicateElement: id =>
          set(state => {
            const element = state.elements.find(el => el.id === id);
            if (!element) return state;

            // Encontrar una posición válida para el elemento duplicado
            // Preferimos una posición cerca del original (offset de 20px)
            const preferredPosition = {
              x: element.position.x + 20,
              y: element.position.y + 20,
            };

            const validPosition = findValidPosition(
              element.dimensions,
              state.elements,
              state.canvasConfig,
              preferredPosition
            );

            const newElement: CanvasElement = {
              ...element,
              id: `${element.type}-${Date.now()}`,
              position: validPosition,
            };

            const newPages = [...state.pages];
            newPages[state.currentPage] = [...state.elements, newElement];

            return {
              pages: newPages,
              elements: newPages[state.currentPage],
              selectedElementId: newElement.id,
            };
          }),

        bringToFront: id =>
          set(state => {
            const maxZIndex = Math.max(...state.elements.map(el => el.zIndex));
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? { ...el, zIndex: maxZIndex + 1 } : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        sendToBack: id =>
          set(state => {
            const minZIndex = Math.min(...state.elements.map(el => el.zIndex));
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? { ...el, zIndex: minZIndex - 1 } : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        // Size configurations
        updateSizeConfig: (size, config) =>
          set(state => ({
            sizeConfigs: state.sizeConfigs.map(sc =>
              sc.size === size ? { ...sc, ...config } : sc
            ),
          })),

        // History management
        saveHistory: () =>
          set(state => {
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push({
              elements: [...state.elements],
              timestamp: Date.now(),
            });

            // Limit history to 50 states
            if (newHistory.length > 50) {
              newHistory.shift();
            }

            return {
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }),

        undo: () =>
          set(state => {
            if (state.historyIndex <= 0) return state;

            const newIndex = state.historyIndex - 1;
            return {
              elements: [...state.history[newIndex].elements],
              historyIndex: newIndex,
            };
          }),

        redo: () =>
          set(state => {
            if (state.historyIndex >= state.history.length - 1) return state;

            const newIndex = state.historyIndex + 1;
            return {
              elements: [...state.history[newIndex].elements],
              historyIndex: newIndex,
            };
          }),

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        // Project management
        saveProject: name =>
          set(state => {
            const project: Project = {
              id: `project-${Date.now()}`,
              name,
              canvasConfig: state.canvasConfig,
              elements: state.elements,
              sizeConfigs: state.sizeConfigs,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            localStorage.setItem(project.id, JSON.stringify(project));

            return { currentProject: project };
          }),

        loadProject: project =>
          set(() => ({
            canvasConfig: project.canvasConfig,
            elements: project.elements,
            sizeConfigs: project.sizeConfigs,
            currentProject: project,
            selectedElementId: null,
          })),

        clearProject: () =>
          set(() => ({
            elements: [],
            selectedElementId: null,
            currentProject: null,
            history: [],
            historyIndex: -1,
          })),

        // UI State
        toggleGrid: () =>
          set(state => ({
            showGrid: !state.showGrid,
          })),

        setZoom: zoom =>
          set(() => ({
            zoom: Math.max(0.1, Math.min(3, zoom)),
          })),

        setCanvasHidden: (hidden: boolean) =>
          set(() => ({
            isCanvasHidden: hidden,
          })),

        setIsExporting: (isExporting: boolean) =>
          set(() => ({
            isExporting,
          })),

        // Uniform sizes configuration
        setUniformSizeImages: (sizeKey: string, images: Partial<SizeImages>) =>
          set(state => ({
            uniformSizesConfig: {
              ...state.uniformSizesConfig,
              [sizeKey]: {
                ...state.uniformSizesConfig[sizeKey],
                ...images,
              },
            },
          })),

        getUniformSizeImages: (sizeKey: string) => {
          return get().uniformSizesConfig[sizeKey];
        },

        getUniformSizeImagesCompressed: (sizeKey: string) => {
          return get().uniformSizesConfigCompressed[sizeKey];
        },

        isSizeComplete: (sizeKey: string) => {
          const images = get().uniformSizesConfig[sizeKey];
          return !!(images?.jerseyFront && images?.jerseyBack && images?.shortsLeft && images?.shortsRight);
        },

        clearUniformSizesConfig: () =>
          set(() => ({
            uniformSizesConfig: {},
            uniformSizesConfigCompressed: {},
          })),

        // Uniform template — plantilla única para todas las tallas
        setUniformTemplate: (images) =>
          set(state => ({
            uniformTemplate: {
              ...(state.uniformTemplate ?? {}),
              ...images,
            },
          })),

        isTemplateComplete: () => {
          const { uniformTemplate } = get();
          return !!(
            uniformTemplate?.jerseyFront &&
            uniformTemplate?.jerseyBack &&
            uniformTemplate?.shortsLeft &&
            uniformTemplate?.shortsRight
          );
        },

        clearUniformTemplate: () =>
          set(() => ({
            uniformTemplate: null,
            uniformTemplateCompressed: null,
            uniformDesignConfig: null,
          })),

        setUniformDesignConfig: (config) =>
          set(() => ({ uniformDesignConfig: config })),

        // Helper para obtener configuración de talla por género
        getSizeConfig: (size: Size, gender: Gender) => {
          const configs = get().sizeConfigs;
          return configs.find(config => config.size === size && config.gender === gender);
        },

        // Bulk Image Upload functions
        setBulkImages: (type, files) =>
          set(state => ({
            bulkImageUpload: {
              ...state.bulkImageUpload,
              [type]: Array.from(files),
            },
          })),

        processBulkImages: async () => {
          const { bulkImageUpload, addElement, canvasConfig, pages, setCanvasHidden } = get();
          const { jerseyFronts, jerseyBacks, shortsRights, shortsLefts } = bulkImageUpload;

          // Validación
          if (jerseyFronts.length !== jerseyBacks.length) {
            alert(`Error: El número de frentes (${jerseyFronts.length}) debe ser igual al número de traseras (${jerseyBacks.length})`);
            return;
          }

          if (shortsRights.length !== shortsLefts.length) {
            alert(`Error: El número de shorts derechos (${shortsRights.length}) debe ser igual al número de izquierdos (${shortsLefts.length})`);
            return;
          }

          // Ocultar canvas mientras procesamos
          setCanvasHidden(true);

          try {
            const allElements: CanvasElement[] = [];
            const BATCH_SIZE = 10;

            // Función auxiliar para cargar dimensiones de una imagen
            const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
              return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);

                img.onload = () => {
                  resolve({ width: img.width, height: img.height });
                  URL.revokeObjectURL(url);
                };

                img.onerror = () => {
                  URL.revokeObjectURL(url);
                  reject(new Error(`No se pudo cargar la imagen: ${file.name}`));
                };

                img.src = url;
              });
            };

            // Función auxiliar para crear un elemento uniform
            const createUniformElement = async (
              file: File,
              part: 'jersey' | 'shorts',
              side: 'front' | 'back' | 'right' | 'left',
              index: number
            ) => {
              const dimensions = await getImageDimensions(file);
              const imageUrl = URL.createObjectURL(file);

              return {
                id: `${part}-${side}-${index}-${Date.now()}`,
                type: 'uniform' as const,
                part,
                side,
                size: 'M' as Size, // Talla por defecto
                position: { x: 0, y: 0 }, // Se calculará con bin-packing
                dimensions: {
                  width: dimensions.width / canvasConfig.pixelsPerCm,
                  height: dimensions.height / canvasConfig.pixelsPerCm,
                },
                rotation: 0,
                zIndex: allElements.length,
                locked: false,
                visible: true,
                baseColor: '#ffffff',
                imageUrl,
                originalImageUrl: imageUrl, // Misma URL para original
                source: 'manual' as const, // Carga masiva de imágenes manuales
              };
            };

            // Procesar playeras en lotes
            for (let i = 0; i < jerseyFronts.length; i += BATCH_SIZE) {
              const batch = Math.min(BATCH_SIZE, jerseyFronts.length - i);

              for (let j = 0; j < batch; j++) {
                const idx = i + j;

                // Crear frente
                const frontElement = await createUniformElement(
                  jerseyFronts[idx],
                  'jersey',
                  'front',
                  idx
                );
                allElements.push(frontElement);

                // Crear trasera
                const backElement = await createUniformElement(
                  jerseyBacks[idx],
                  'jersey',
                  'back',
                  idx
                );
                allElements.push(backElement);
              }

              // Pausa entre lotes
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Procesar shorts en lotes
            for (let i = 0; i < shortsRights.length; i += BATCH_SIZE) {
              const batch = Math.min(BATCH_SIZE, shortsRights.length - i);

              for (let j = 0; j < batch; j++) {
                const idx = i + j;

                // Crear derecho
                const rightElement = await createUniformElement(
                  shortsRights[idx],
                  'shorts',
                  'right',
                  idx
                );
                allElements.push(rightElement);

                // Crear izquierdo
                const leftElement = await createUniformElement(
                  shortsLefts[idx],
                  'shorts',
                  'left',
                  idx
                );
                allElements.push(leftElement);
              }

              // Pausa entre lotes
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Agregar todos los elementos al canvas
            // Primero, aplicar bin-packing para calcular posiciones
            const { optimizeLayoutAdvanced } = await import('../utils/binPacking');

            const result = optimizeLayoutAdvanced(
              allElements,
              canvasConfig,
              {
                elementGap: 5,
                canvasMargin: 0,
                canvasMarginV: 0,
                allowRotation: false,
                sortStrategy: 'area',
                heuristic: 'BSSF',
              }
            );

            // Crear páginas adicionales si es necesario
            const currentPages = pages.length;
            for (let i = currentPages; i < result.pagesUsed; i++) {
              get().addPage();
            }

            // Agregar elementos a sus respectivas páginas
            result.pages.forEach((pageElements, pageIndex) => {
              pageElements.forEach(element => {
                addElement(element, pageIndex);
              });
            });

            // Limpiar estado temporal
            get().clearBulkImages();

            // Mostrar canvas
            setCanvasHidden(false);

            alert(`¡Carga completada!\n\nElementos procesados: ${allElements.length}\nPáginas utilizadas: ${result.pagesUsed}\nEficiencia: ${result.efficiency.toFixed(1)}%`);

          } catch (error) {
            console.error('Error al procesar imágenes:', error);
            alert('Error al procesar las imágenes. Por favor, intenta de nuevo.');
            setCanvasHidden(false);
          }
        },

        clearBulkImages: () =>
          set(() => ({
            bulkImageUpload: {
              jerseyFronts: [],
              jerseyBacks: [],
              shortsRights: [],
              shortsLefts: [],
            },
          })),
      }),
      {
        name: "designer-storage-v7", // uniformSizesConfig NO se persiste (solo en memoria)
        partialize: state => ({
          canvasConfig: state.canvasConfig,
          sizeConfigs: state.sizeConfigs,
          // uniformSizesConfig: NO se guarda en localStorage para evitar problemas de espacio
          showGrid: state.showGrid,
          uniformDesignConfig: state.uniformDesignConfig,
        }),
      }
    )
  )
);
