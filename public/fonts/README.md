# Fuentes Personalizadas

Esta carpeta es para almacenar archivos de fuentes personalizadas que no están disponibles en Google Fonts.

## 🎯 Fuentes Configuradas

El sistema está preconfigurado para cargar las siguientes fuentes personalizadas:

1. **Atlanta College** → `AtlantaCollege.ttf`
2. **Basketball** → `Basketball.ttf`
3. **Athletic** → `Athletic.ttf`
4. **Arial Black** → `ArialBlack.ttf`

## 📥 Cómo instalar las fuentes:

### Paso 1: Obtener los archivos de fuentes
Descarga los archivos de fuentes (.ttf, .otf, .woff, .woff2) de las fuentes que necesites.

**Fuentes mencionadas:**
- Atlanta College: Disponible en sitios como 1001fonts.com, Font.Download, CDNFonts.com
- Basketball: Buscar en repositorios de fuentes deportivas
- Athletic: Buscar en repositorios de fuentes deportivas
- Arial Black: Puede estar instalada en tu sistema o descargable de repositorios de fuentes

### Paso 2: Colocar los archivos en esta carpeta
Copia los archivos de fuentes a esta carpeta (`public/fonts/`) con los nombres exactos especificados arriba.

**Ejemplo de estructura:**
```
public/fonts/
  ├── README.md
  ├── AtlantaCollege.ttf
  ├── Basketball.ttf
  ├── Athletic.ttf
  └── ArialBlack.ttf
```

### Paso 3: Verificar que funcionen
1. Inicia el proyecto: `npm run dev`
2. Abre la aplicación en el navegador
3. Agrega un elemento de texto al canvas
4. Abre el selector de fuentes (icono de texto en la barra superior)
5. Busca las fuentes personalizadas en la lista

## 🔧 Agregar nuevas fuentes personalizadas

Si deseas agregar más fuentes personalizadas además de las preconfiguradas:

1. **Coloca el archivo de fuente** en esta carpeta
2. **Edita el archivo** `src/utils/fontLoader.ts`
3. **Agrega la fuente** a la lista `CUSTOM_FONTS`:
   ```typescript
   export const CUSTOM_FONTS = [
     "Atlanta College",
     "Basketball",
     "Athletic",
     "Arial Black",
     "Tu Nueva Fuente", // ← Agregar aquí
   ] as const;
   ```
4. **Registra la fuente** en la función `initializeCustomFonts()`:
   ```typescript
   registerCustomFont(
     "Tu Nueva Fuente",
     "/fonts/TuNuevaFuente.ttf",  // Ruta al archivo
     "truetype"                    // Formato: truetype, opentype, woff, woff2
   );
   ```

## 📝 Formatos de fuente soportados

- **.ttf** (TrueType Font) - `format: 'truetype'`
- **.otf** (OpenType Font) - `format: 'opentype'`
- **.woff** (Web Open Font Format) - `format: 'woff'`
- **.woff2** (Web Open Font Format 2) - `format: 'woff2'`

## ⚠️ Importante

- Los nombres de archivo deben coincidir exactamente con los especificados en `initializeCustomFonts()`
- Las fuentes deben ser legalmente obtenidas y cumplir con sus licencias
- Las fuentes personalizadas se cargan dinámicamente solo cuando se usan, optimizando el rendimiento

## 🎨 Uso en la aplicación

Las fuentes personalizadas aparecerán automáticamente en:
- Selector de fuentes del Header (icono de texto)
- Selector de fuentes del Toolbar (pestaña "Editar")
- Importación desde Excel (columna "fuente")

¡Todo listo para usar fuentes personalizadas en tus diseños de uniformes! 🚀
