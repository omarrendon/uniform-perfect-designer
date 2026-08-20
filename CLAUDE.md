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
- `Size` — `'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL'`
- `SizeSpanish` — `'XCH' | 'CH' | 'M' | 'G' | 'XG' | '2XG' | '3XG' | '4XG'` (mapeo via `SIZE_MAP`)
- `SIZE_ORDER` — las 8 tallas en orden ascendente; usarlo en selectores y recorridos
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

**Por qué es posible escalar:** Las proporciones son constantes en las 8 tallas:
- Playera: ratio 0.7206 (Hombre) | 0.7242 (Mujer)
- Shorts: ratio 1.3755 (Hombre) | 1.3784 (Mujer)

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
5. Las dimensiones se determinan por `talla` y `genero` del Excel (no por imagen).
   La columna `talla` se normaliza con `normalizeSize()` / `toSpanishSize()` de
   `src/utils/designMapper.ts` — único lugar donde viven los alias de talla.
   Los elementos guardan siempre la talla canónica (`'XXL'`), nunca el alias del Excel (`'2XG'`)
6. `binPacking.ts` organiza el layout con algoritmo **MaxRects**
7. Se detectan colisiones con `checkOverlap()` de `canvas.ts`

El algoritmo de bin-packing usa heurística BL (Bottom-Left) con orden por área (largest-first).

**Nota:** `Toolbar.tsx` también tiene su propio loop de procesamiento Excel (`handleExcelUpload`) además del flujo via `UniformSizesModal`. Ambos usan `uniformTemplate`.

---

## Tallas — medidas en píxeles (`pixelsPerCm = 10`)

Fuente de verdad en código: `SIZE_CONFIGS_HOMBRE` / `SIZE_CONFIGS_MUJER` en
`src/store/desingerStore.ts`. **No se persisten en localStorage** — son tabla estática;
el `merge` del persist descarta cualquier copia vieja guardada.

Procedencia de los datos:

| Tallas | Origen |
|---|---|
| S, M, L, XL (ambos géneros) | `TABLA-TALLAS.xlsx` (jun 2026) — oficiales |
| XS, XXL, 3XL, 4XL — **jersey Hombre** | `MEDIDAS DE TALLAS DE CABALLERO.pdf` (ago 2026), medido del trazo vectorial — exactas |
| XS, XXL, 3XL, 4XL — **shorts Hombre** | `MEDIDAS TALLAS PARA CABALLERO SHORT FUTBOL.pdf` (ago 2026), medido del trazo vectorial — exactas |
| XS, XXL, 3XL, 4XL — manga Hombre y **todo Mujer** | **Derivadas** — validar con patronista antes de producir |

⚠️ El short **no** crece linealmente: su paso pasa de +31.33 px (S→XL) a +33.88 px
después de XL. La playera sí es lineal en las 8 tallas. No extrapolar shorts como si
lo fueran — fue el error que corrigió el PDF de shorts.

### Hombre

| Talla | Jersey (w×h px) | Shorts (w×h px) | Manga (w×h px) |
|---|---|---|---|
| XS | 513.61×712.73 | 690.00×501.63 | 412.54×240.25 |
| S | 535.75×743.44 | 720.50×523.80 | 430.32×250.60 |
| M | 559.04×775.77 | 751.83×546.58 | 449.03×261.49 |
| L | 582.33×808.09 | 783.15×569.35 | 467.74×272.39 |
| XL | 605.63×840.41 | 814.48×592.13 | 486.45×283.29 |
| XXL | 628.92×872.74 | 847.06×615.81 | 505.16×294.19 |
| 3XL | 652.21×905.06 | 880.94×640.44 | 523.87×305.08 |
| 4XL | 675.51×937.38 | 914.82×665.08 | 542.58×315.98 |

### Mujer

| Talla | Jersey (w×h px) | Shorts (w×h px) | Manga (w×h px) |
|---|---|---|---|
| XS | 480.33×663.22 | 641.37×465.32 | 367.00×216.50 |
| S | 501.03×691.80 | 669.72×485.89 | 382.82×225.83 |
| M | 526.08×726.39 | 706.93×512.88 | 401.96×237.12 |
| L | 551.13×760.98 | 744.14×539.88 | 421.10×248.41 |
| XL | 576.18×795.56 | 781.34×566.87 | 440.24×259.70 |
| XXL | 601.23×830.15 | 812.59×589.54 | 459.38×270.99 |
| 3XL | 626.28×864.73 | 845.10×613.12 | 478.52×282.28 |
| 4XL | 651.33×899.32 | 877.60×636.71 | 497.66×293.57 |

El cuello es único para todas las tallas y géneros: 650×60 px (65×6 cm).

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
