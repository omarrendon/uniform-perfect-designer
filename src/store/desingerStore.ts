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
  HistoryState,
  Project,
  Size,
  SizeConfig,
  SizeSpanish,
  SizeImages,
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
  setUniformSizeImages: (size: SizeSpanish, images: Partial<SizeImages>) => void;
  getUniformSizeImages: (size: SizeSpanish) => SizeImages | undefined;
  getUniformSizeImagesCompressed: (size: SizeSpanish) => SizeImages | undefined;
  isSizeComplete: (size: SizeSpanish) => boolean;
  clearUniformSizesConfig: () => void;

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
}

const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 159, // cm - ancho para impresión (basado en benito.pdf)
  height: 380, // cm - alto para impresión (basado en benito.pdf)
  pixelsPerCm: 10,
};

const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
  // Medidas realistas en píxeles (dividir entre 10 para obtener cm)
  // pixelsPerCm = 10, entonces 500px = 50cm
  { size: "XS", width: 400, height: 600 },  // XS: 40cm × 60cm
  { size: "S", width: 450, height: 650 },   // S:  45cm × 65cm
  { size: "M", width: 500, height: 700 },   // M:  50cm × 70cm (base)
  { size: "L", width: 550, height: 750 },   // L:  55cm × 75cm
  { size: "XL", width: 600, height: 800 },  // XL: 60cm × 80cm
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
        history: [],
        historyIndex: -1,
        currentProject: null,
        showGrid: true,
        zoom: 1,
        isCanvasHidden: false,

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
        // La altura máxima es DEFAULT_CANVAS_CONFIG.height
        // TODAS las páginas se recortan al tamaño exacto de sus elementos (sin espacio en blanco)
        getPageHeight: (pageIndex: number) => {
          const state = get();
          const maxHeight = DEFAULT_CANVAS_CONFIG.height;

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

          // Convertir de píxeles a cm
          const heightInCm = maxY / DEFAULT_CANVAS_CONFIG.pixelsPerCm;

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

        // Uniform sizes configuration
        setUniformSizeImages: (size: SizeSpanish, images: Partial<SizeImages>) =>
          set(state => ({
            uniformSizesConfig: {
              ...state.uniformSizesConfig,
              [size]: {
                ...state.uniformSizesConfig[size],
                ...images,
              },
            },
          })),

        getUniformSizeImages: (size: SizeSpanish) => {
          return get().uniformSizesConfig[size];
        },

        getUniformSizeImagesCompressed: (size: SizeSpanish) => {
          return get().uniformSizesConfigCompressed[size];
        },

        isSizeComplete: (size: SizeSpanish) => {
          const images = get().uniformSizesConfig[size];
          return !!(images?.jerseyFront && images?.jerseyBack && images?.shorts);
        },

        clearUniformSizesConfig: () =>
          set(() => ({
            uniformSizesConfig: {},
            uniformSizesConfigCompressed: {},
          })),
      }),
      {
        name: "designer-storage-v7", // uniformSizesConfig NO se persiste (solo en memoria)
        partialize: state => ({
          canvasConfig: state.canvasConfig,
          sizeConfigs: state.sizeConfigs,
          // uniformSizesConfig: NO se guarda en localStorage para evitar problemas de espacio
          showGrid: state.showGrid,
        }),
      }
    )
  )
);
