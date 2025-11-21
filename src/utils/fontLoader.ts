/**
 * Utilidad para cargar fuentes de Google Fonts dinámicamente
 */

// Lista de fuentes disponibles de Google Fonts
export const GOOGLE_FONTS = [
  "Arial", // Fuente del sistema (fallback)
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Lato",
  "Oswald",
  "Raleway",
  "PT Sans",
  "Merriweather",
  "Nunito",
  "Playfair Display",
  "Ubuntu",
  "Poppins",
  "Bebas Neue",
  "Pacifico",
  "Dancing Script",
  "Righteous",
  "Anton",
  "Architects Daughter",
  "Permanent Marker",
  // Fuentes deportivas y de impacto
  "Alfa Slab One",
  "Black Ops One",
  "Bungee",
  "Bungee Inline",
  "Russo One",
  "Teko",
  "Squada One",
  "Saira Condensed",
  "Barlow Condensed",
  "Pathway Gothic One",
  // Fuentes elegantes y modernas
  "Cinzel",
  "Cormorant Garamond",
  "Great Vibes",
  "Satisfy",
  "Caveat",
  "Shadows Into Light",
  "Amatic SC",
  // Fuentes clásicas y serif
  "Libre Baskerville",
  "Crimson Text",
  "EB Garamond",
  "Merriweather Sans",
  // Fuentes sans-serif versátiles
  "Inter",
  "Work Sans",
  "Manrope",
  "Rubik",
  "Source Sans Pro",
  "Noto Sans",
  "Quicksand",
  "Karla",
] as const;

export type GoogleFont = (typeof GOOGLE_FONTS)[number];

// Cache de fuentes ya cargadas
const loadedFonts = new Set<string>();

/**
 * Carga una fuente de Google Fonts dinámicamente
 * @param fontName Nombre de la fuente a cargar
 * @returns Promise que se resuelve cuando la fuente está cargada
 */
export const loadGoogleFont = async (fontName: string): Promise<void> => {
  // Si es Arial o ya está cargada, no hacer nada
  if (fontName === "Arial" || loadedFonts.has(fontName)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Convertir el nombre de la fuente al formato de Google Fonts
    const fontNameFormatted = fontName.replace(/\s+/g, "+");

    // Crear el link element
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontNameFormatted}:wght@400;700&display=swap`;

    // Manejar eventos de carga
    link.onload = () => {
      loadedFonts.add(fontName);
      // Esperar un poco para asegurar que el navegador ha procesado la fuente
      setTimeout(() => resolve(), 100);
    };

    link.onerror = () => {
      console.error(`Error al cargar la fuente: ${fontName}`);
      reject(new Error(`Failed to load font: ${fontName}`));
    };

    // Agregar al head del documento
    document.head.appendChild(link);
  });
};

/**
 * Carga múltiples fuentes de Google Fonts
 * @param fontNames Array de nombres de fuentes a cargar
 */
export const loadMultipleFonts = async (
  fontNames: string[]
): Promise<void> => {
  const promises = fontNames
    .filter(font => font !== "Arial" && !loadedFonts.has(font))
    .map(font => loadGoogleFont(font));

  await Promise.allSettled(promises);
};

/**
 * Valida si una fuente existe en la lista de fuentes disponibles
 * @param fontName Nombre de la fuente a validar
 * @returns true si existe, false si no
 */
export const isValidFont = (fontName: string): boolean => {
  return GOOGLE_FONTS.includes(fontName as GoogleFont);
};

/**
 * Obtiene el nombre de fuente válido o retorna el fallback
 * @param fontName Nombre de la fuente
 * @param fallback Fuente de fallback (default: Arial)
 * @returns Nombre de fuente válido
 */
export const getValidFontOrFallback = (
  fontName: string | undefined,
  fallback: string = "Arial"
): string => {
  if (!fontName) return fallback;

  const trimmedFont = fontName.trim();
  return isValidFont(trimmedFont) ? trimmedFont : fallback;
};
