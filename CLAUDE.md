# CLAUDE.md — Uniform Perfect Designer

Guía de referencia para trabajar en este proyecto con Claude Code.

---

## ¿Qué es este proyecto?

Aplicación web para diseñar y exportar uniformes deportivos (camisetas y shorts) de manera masiva. Permite diseño manual en canvas, carga masiva desde Excel y exportación PDF/PNG profesional con gestión de color CMYK para impresión.

---

## Comandos esenciales

```bash
npm run dev        # Servidor de desarrollo (Vite + HMR)
npm run build      # TypeScript check + build de producción
npm run lint       # ESLint con reglas TypeScript
npm run preview    # Preview del build de producción
```

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript 5 |
| Build | Vite 7 + SWC |
| Estado | Zustand 4 (store único con devtools + persist) |
| Canvas | Konva 9 + React Konva |
| PDF | pdf-lib 1.17 |
| Excel | XLSX 0.18 |
| Estilos | Tailwind CSS + clsx + tailwind-merge |
| Formularios | React Hook Form + Zod |

---

## Arquitectura y estructura

```
src/
├── components/      # Componentes UI reutilizables (Button, Input, Modales)
├── modules/         # Componentes complejos de página (Canvas, Header, Elements)
├── hooks/           # Custom hooks transversales (useHistory, useAutoSave, useKeyboardShortcuts)
├── store/           # Estado global Zustand → desingerStore.ts
├── types/           # Todos los tipos TypeScript → index.ts
├── utils/           # Lógica de negocio pura (export, Excel, colores, layout)
└── pages/           # Páginas (DesingerPage.tsx)

public/
└── moldes/          # Imágenes de plantillas de camisetas y shorts
```

### Regla de ubicación de código

- `components/` → UI pura, sin lógica de negocio, reutilizable en cualquier contexto
- `modules/` → Componentes complejos o específicos de la feature de diseño
- `utils/` → Funciones puras sin dependencia de React (no hooks, no JSX)
- `hooks/` → Lógica React reutilizable que no pertenece al store
- **No crear** nuevas carpetas sin justificación; encajar en las existentes primero

---

## Estado global (Zustand)

El archivo `src/store/desingerStore.ts` es la única fuente de verdad.

- Middleware activo: `devtools` + `persist` (localStorage)
- Multi-página: `pages: CanvasElement[][]` + `currentPage: number`
- Historial: array lineal con índice para undo/redo
- **Nunca** pasar estado global por props — los componentes acceden al store directamente

### Nota sobre el typo en el nombre
El store y la página se llaman `desinger` (sin la 'i' correcta). **No renombrar** sin actualizar todas las referencias — actualmente es consistente en todo el proyecto.

---

## Sistema de tipos

Todos los tipos viven en `src/types/index.ts`. Antes de crear un tipo nuevo, verificar que no exista ahí.

Tipos clave:
- `CanvasElement = UniformTemplate | TextElement | ImageElement` — unión discriminada por `type`
- `Size` — `'XS' | 'S' | 'M' | 'L' | 'XL'`
- `SizeSpanish` — `'XCH' | 'CH' | 'M' | 'G' | 'XG'` (mapeo via `SIZE_MAP`)
- `UniformPart` — `'jersey' | 'shorts'`
- `Gender` — `'Hombre' | 'Mujer'`

---

## Imágenes: sistema de calidad dual

Las imágenes se almacenan en **dos versiones** simultáneamente:

| Versión | Campo | Uso | Calidad |
|---|---|---|---|
| Original | `uniformTemplate` / `uniformSizesConfig` | Export PDF | 100% |
| Comprimida | `uniformTemplateCompressed` / `uniformSizesConfigCompressed` | Canvas (display) | 40% JPEG, 50% escala |

**Nunca** usar la versión comprimida para exportar. **Nunca** usar la original en el canvas sin comprimir (perf).

---

## Sistema de plantilla única (`uniformTemplate`)

Desde la refactorización, la carga masiva desde Excel usa **una sola plantilla de 4 imágenes** que se escala automáticamente a todas las tallas:

| Campo del store | Descripción |
|---|---|
| `uniformTemplate` | Las 4 imágenes originales (jerseyFront, jerseyBack, shortsLeft, shortsRight) |
| `uniformTemplateCompressed` | Versión comprimida para canvas (se genera al procesar el Excel) |
| `setUniformTemplate(images)` | Guarda parcialmente las imágenes del template |
| `isTemplateComplete()` | Devuelve `true` si las 4 imágenes están cargadas |
| `clearUniformTemplate()` | Limpia el template y su versión comprimida |

**Por qué es posible escalar:** Las proporciones de todas las tallas son prácticamente idénticas:
- Playera: ratio ~0.718 en XS, S, M, L, XL
- Shorts: ratio ~1.433 en XS, S, M, L, XL

Konva aplica el escalado automáticamente vía `width={element.dimensions.width}` en `UniformElement.tsx`.

`uniformTemplate` y `uniformTemplateCompressed` **no se persisten** en localStorage (mismo comportamiento que `uniformSizesConfig`). Se deben recargar en cada sesión.

---

## Sistema de coordenadas

- **Canvas (Konva)**: píxeles, origen arriba-izquierda
- **PDF (pdf-lib)**: puntos (1pt = 1/72"), origen abajo-izquierda
- La transformación ocurre en `src/utils/export.ts`
- `pixelsPerCm = 10` es la constante de conversión en todo el proyecto

---

## Exportación PDF

Pipeline en `src/utils/export.ts`:

1. `preflight.ts` — valida el diseño antes de exportar
2. `colorConversion.ts` — convierte RGB → CMYK con perfil ICC FOGRA39
3. `pdf-lib` genera el PDF con fuentes embebidas
4. `printMarks.ts` — añade marcas de corte, registro y barras de color
5. Archivo descargado al navegador (client-side, sin servidor)

**No modificar** el orden del pipeline ni omitir preflight.

---

## Carga masiva Excel

Flujo en `src/utils/excelProcessor.ts`:

1. `excelReader.ts` parsea el `.xlsx`
2. Se valida que el template esté completo (`isTemplateComplete()`)
3. Se comprime el template una sola vez para canvas
4. Se crea par jersey + shorts por fila
5. Las dimensiones se determinan por `talla` y `genero` del Excel (no por imagen)
6. `binPacking.ts` organiza el layout con algoritmo **MaxRects**
7. Se detectan colisiones con `checkOverlap()` de `canvas.ts`

El algoritmo de bin-packing usa heurística BL (Bottom-Left) con orden por área (largest-first).

**Nota:** `Toolbar.tsx` también tiene su propio loop de procesamiento Excel (`handleExcelUpload`) además del flujo via `UniformSizesModal`. Ambos usan `uniformTemplate`.

---

## Tallas — medidas en píxeles (`pixelsPerCm = 10`)

| Talla | Jersey (w×h) | Shorts (w×h) |
|---|---|---|
| XS | 513×714 | 780×544 |
| S | 540×752 | 821×572 |
| M | 568×791 | 863×602 |
| L | 599×834 | 906×632 |
| XL | 629×875 | 952×664 |

> Las medidas femeninas (`Gender = 'Mujer'`) aún usan los valores masculinos como placeholder. Actualizar con valores reales cuando estén disponibles.

---

## Convenciones de código

- **Nombres**: PascalCase para componentes y tipos, camelCase para funciones y variables, UPPER_SNAKE_CASE para constantes
- **Comentarios**: solo cuando el *por qué* no es obvio — no explicar *qué* hace el código
- **No agregar** manejo de errores para casos que no pueden ocurrir
- **No abstraer** hasta tener al menos 3 repeticiones reales
- Usar `cn()` de `src/utils/cn.ts` para combinar clases Tailwind (no string literals directos)
- Los formularios usan React Hook Form + Zod; no implementar validación manual

---

## Atajos de teclado

Implementados en `src/hooks/useKeyboardShortcuts.tsx`:

| Atajo | Acción |
|---|---|
| `Delete` / `Backspace` | Eliminar elemento seleccionado |
| `Ctrl/Cmd+D` | Duplicar elemento |
| `Ctrl/Cmd+G` | Toggle grid |
| `Ctrl/Cmd+S` | Guardar proyecto |
| `Escape` | Deseleccionar |

Los atajos se ignoran automáticamente cuando el foco está en un input.

---

## Auto-save

`src/hooks/useAutoSave.tsx` guarda el estado completo en `localStorage` cada 30 segundos. Zustand `persist` también persiste en cada cambio de estado. No es necesario implementar guardado adicional fuera del store.

---

## Fuentes

- 70+ Google Fonts cargadas dinámicamente via `src/utils/fontLoader.ts`
- Fuentes deportivas incluidas: Bebas Neue, Black Ops One, Impact, etc.
- Para PDF: las fuentes se **embeben** en el archivo — no se puede referenciar una fuente que no esté cargada
- Fallback: Arial si la fuente solicitada no está disponible

---

## Perfiles de color disponibles

Definidos en `src/utils/iccProfiles.ts`:

| Perfil | Uso recomendado |
|---|---|
| **FOGRA39** | Impresión offset Europa (default) |
| FOGRA45 | Papel sin recubrimiento Europa |
| SWOP | Impresión offset EEUU |
| Japan Color | Mercado japonés |

Cambiar el perfil solo si el cliente especifica un estándar diferente.

---

## Lo que NO hacer

- No importar `sharp` en código cliente — es devDependency para scripts de Node
- No usar `pdfkit` directamente — el proyecto usa `pdf-lib`; pdfkit es legacy
- No llamar `getState()` del store fuera de React — usar el hook `useDesignerStore()`
- No guardar lógica de canvas dentro de componentes — va en `src/utils/canvas.ts`
- No duplicar tipos — todo en `src/types/index.ts`
- No crear componentes nuevos en `modules/` si son reutilizables — van en `components/`

---

## Documentación adicional en el proyecto

| Archivo | Contenido |
|---|---|
| `CARGA_MASIVA_EXCEL.md` | Formato y reglas del Excel para carga masiva |
| `INSTRUCCIONES_MOLDES.md` | Cómo agregar/reemplazar plantillas de moldes |
| `POSICIONAMIENTO_VERTICAL.md` | Especificaciones de posicionamiento de texto por talla |
| `ROTACION_IMAGENES.md` | Manejo de rotación de imágenes en canvas y PDF |
