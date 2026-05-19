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
  // Fuentes deportivas y atléticas adicionales
  "Kanit",
  "Rajdhani",
  "Exo 2",
  "Orbitron",
  "Electrolize",
  "Aldrich",
  "Audiowide",
  "Changa",
  "Saira",
  "Titillium Web",
  "Chakra Petch",
  "Share Tech",
  "Michroma",
  "Oxanium",
  "Fugaz One",
  "Passion One",
  "Bangers",
  "Big Shoulders Display",
  "Big Shoulders Text",
  "Prosto One",
  "Quantico",
  "Khand",
  "Advent Pro",
  "Faster One",
  "Stalinist One",
  "Bai Jamjuree",
  "Encode Sans",
  "Encode Sans Condensed",
  "Bruno Ace",
  "Bungee Shade",
  "Bungee Outline",
  "Bungee Hairline",
  "Turret Road",
  "Days One",
  "Unica One",
  "Monda",
  "Strait",
  "Armata",
  "Viga",
  "Telex",
  "Jura",
  "Syncopate",
  "Press Start 2P",
  "Kelly Slab",
  "Contrail One",
  "Cuprum",
  "Graduate",
  "Coda",
  "Amiko",
  "Encode Sans Expanded",
  "Istok Web",
  "Fjalla One",
  "Yanone Kaffeesatz",
  "Asul",
  "Varta",
  "Atkinson Hyperlegible",
  // Fuentes elegantes y sofisticadas
  "Lora",
  "Italiana",
  "Vidaloka",
  "Belleza",
  "Cardo",
  "Philosopher",
  "Spectral",
  "Yeseva One",
  "Marcellus",
  "Tenor Sans",
  "Julius Sans One",
  "Forum",
  "Arapey",
  "Abhaya Libre",
  "Cormorant",
  "Cormorant Infant",
  "Cormorant SC",
  "Cormorant Unicase",
  "Cormorant Upright",
  "Gilda Display",
  "Cinzel Decorative",
  "Pridi",
  "Trirong",
  "Gabriela",
  "Sorts Mill Goudy",
  "Fanwood Text",
  "Alike",
  "Alike Angular",
  "Coustard",
  "Unna",
  "Adamina",
  "Podkova",
  "Amethysta",
  "Vollkorn",
  "Vollkorn SC",
  "Andada Pro",
  "Ovo",
  "Neuton",
  "Poly",
  "Mate",
  "Mate SC",
  "Alegreya",
  "Alegreya SC",
  "Gentium Book Plus",
  "Gentium Plus",
  "Ledger",
  "Rasa",
  "Tienne",
  "Alice",
  "Rhodium Libre",
  "Rozha One",
  "Cutive",
  "Cambo",
  "Lustria",
  "Domine",
  "Linden Hill",
  "Buenard",
  "Caudex",
  "Karma",
  "Eczar",
  "Vesper Libre",
  "Crimson Pro",
  "Frank Ruhl Libre",
  // Fuentes novedosas y contemporáneas
  "Space Grotesk",
  "Outfit",
  "Plus Jakarta Sans",
  "DM Sans",
  "Red Hat Display",
  "Epilogue",
  "Sora",
  "Lexend",
  "Urbanist",
  "Be Vietnam Pro",
  "Familjen Grotesk",
  "Schibsted Grotesk",
  "General Sans",
  "Cabinet Grotesk",
  "Albert Sans",
  "Archivo",
  "Archivo Black",
  "Archivo Narrow",
  "Barlow",
  "Darker Grotesque",
  "Golos Text",
  "Grandstander",
  "Grenze Gotisch",
  "Hepta Slab",
  "IBM Plex Sans",
  "IBM Plex Mono",
  "IBM Plex Serif",
  "JetBrains Mono",
  "Kumbh Sans",
  "League Spartan",
  "Manuale",
  "Maven Pro",
  "M PLUS 1",
  "M PLUS 2",
  "M PLUS Rounded 1c",
  "Newsreader",
  "Overpass",
  "Overpass Mono",
  "Public Sans",
  "Recursive",
  "Sen",
  "Signika",
  "Signika Negative",
  "Sofia Sans",
  "Trispace",
  "Unbounded",
  "Victor Mono",
  "Ysabeau",
  "Anybody",
  "Hanken Grotesk",
  "Instrument Sans",
  "Azeret Mono",
  "Fraunces",
  "Commissioner",
  "Bodoni Moda",
  "Readex Pro",
  "Spline Sans",
  "Bitter",
  "Literata",
  "Petrona",
  "Atkinson Hyperlegible",
  // Fuentes modernas y geométricas
  "Jost",
  "Space Mono",
  "Josefin Sans",
  "Comfortaa",
  "Almarai",
  "Syne",
  "Geologica",
  "Exo",
  "Hind",
  "Hind Madurai",
  "Hind Siliguri",
  "Hind Vadodara",
  "Yantramanav",
  "Varela Round",
  "Varela",
  "Montserrat Alternates",
  "Asap",
  "Asap Condensed",
  "Cabin",
  "Cabin Condensed",
  "Heebo",
  "Mukta",
  "Mukta Mahee",
  "Mukta Malar",
  "Mukta Vaani",
  "Catamaran",
  "Oxygen",
  "Oxygen Mono",
  "Cairo",
  "Tajawal",
  "Alef",
  "Harmattan",
  "Amiri",
  "Scheherazade New",
  "Mirza",
  "Lalezar",
  "Baloo 2",
  "Laila",
  "Yrsa",
  "Ruda",
  "Sarabun",
  "Mitr",
  "Prompt",
  "Athiti",
  "Kodchasan",
  "K2D",
  "Niramit",
  "Mali",
  "Maitree",
  "Charm",
  "Charmonman",
  "Fahkwang",
  "Noto Sans Thai",
  "Taviraj",
  "Sriracha",
  "Pattaya",
  "Srisakdi",
  "Pridi",
] as const;

export type GoogleFont = (typeof GOOGLE_FONTS)[number];

// ============================================
// SISTEMA DE FUENTES PERSONALIZADAS
// ============================================

// Lista de fuentes personalizadas (locales)
export const CUSTOM_FONTS = [
  "Atlanta College",
  "Basketball",
  "Athletic",
  "Arial Black",
] as const;

export type CustomFont = (typeof CUSTOM_FONTS)[number];

// Tipo combinado de todas las fuentes disponibles
export type AvailableFont = GoogleFont | CustomFont;

// Lista completa de fuentes (Google + Personalizadas)
export const ALL_FONTS: readonly AvailableFont[] = [
  ...GOOGLE_FONTS,
  ...CUSTOM_FONTS,
] as const;

// Cache de fuentes ya cargadas
const loadedFonts = new Set<string>();

// Registro de fuentes personalizadas con sus rutas
interface CustomFontConfig {
  name: string;
  path: string;
  format: "truetype" | "opentype" | "woff" | "woff2";
}

const customFontRegistry: Map<string, CustomFontConfig> = new Map();

// Nombres de fuentes subidas por el usuario (en memoria, se hidratan al arrancar)
const userFontNames = new Set<string>();

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
export const loadMultipleFonts = async (fontNames: string[]): Promise<void> => {
  const promises = fontNames
    .filter(font => font !== "Arial" && !loadedFonts.has(font))
    .map(font => loadGoogleFont(font));

  await Promise.allSettled(promises);
};

/**
 * Registra una fuente personalizada para su uso
 * @param name Nombre de la fuente
 * @param path Ruta al archivo de fuente (relativa a /public)
 * @param format Formato del archivo de fuente
 */
export const registerCustomFont = (
  name: string,
  path: string,
  format: "truetype" | "opentype" | "woff" | "woff2"
): void => {
  customFontRegistry.set(name, { name, path, format });
};

/**
 * Carga una fuente personalizada usando @font-face
 * @param fontName Nombre de la fuente personalizada
 * @returns Promise que se resuelve cuando la fuente está cargada
 */
export const loadCustomFont = async (fontName: string): Promise<void> => {
  // Si ya está cargada, no hacer nada
  if (loadedFonts.has(fontName)) {
    return Promise.resolve();
  }

  const fontConfig = customFontRegistry.get(fontName);
  if (!fontConfig) {
    console.warn(`Fuente personalizada "${fontName}" no está registrada`);
    return Promise.reject(
      new Error(`Custom font "${fontName}" not registered`)
    );
  }

  return new Promise((resolve, reject) => {
    try {
      // Crear la regla @font-face
      const fontFace = new FontFace(
        fontConfig.name,
        `url(${fontConfig.path}) format('${fontConfig.format}')`,
        {
          weight: "normal",
          style: "normal",
        }
      );

      // Cargar la fuente
      fontFace
        .load()
        .then(loadedFace => {
          // Agregar la fuente al documento
          (document as any).fonts.add(loadedFace);
          loadedFonts.add(fontName);

          console.log(
            `✅ Fuente personalizada "${fontName}" cargada exitosamente`
          );
          console.log(`   📝 Nombre de familia: ${loadedFace.family}`);
          console.log(`   📝 Estilo: ${loadedFace.style}`);
          console.log(`   📝 Peso: ${loadedFace.weight}`);
          console.log(`   📝 Ruta: ${fontConfig.path}`);
          resolve();
        })
        .catch(error => {
          console.error(
            `Error al cargar la fuente personalizada "${fontName}":`,
            error
          );
          reject(error);
        });
    } catch (error) {
      console.error(`Error al crear FontFace para "${fontName}":`, error);
      reject(error);
    }
  });
};

/**
 * Verifica si una fuente es personalizada (local) o de Google Fonts
 * @param fontName Nombre de la fuente
 * @returns true si es personalizada, false si es de Google Fonts
 */
export const isCustomFont = (fontName: string): boolean => {
  return CUSTOM_FONTS.includes(fontName as CustomFont);
};

/**
 * Verifica si una fuente fue subida por el usuario
 */
export const isUserFont = (fontName: string): boolean => {
  return userFontNames.has(fontName);
};

/**
 * Carga una fuente subida por el usuario desde un data URL (base64)
 * @param name Nombre de la fuente
 * @param dataUrl Data URL base64 del archivo de fuente
 * @param format Formato de la fuente
 */
export const loadUserFontFromDataUrl = async (
  name: string,
  dataUrl: string,
  format: "truetype" | "opentype" | "woff" | "woff2"
): Promise<void> => {
  if (loadedFonts.has(name)) return;

  const fontFace = new FontFace(
    name,
    `url(${dataUrl}) format('${format}')`,
    { weight: "normal", style: "normal" }
  );

  const loaded = await fontFace.load();
  (document as any).fonts.add(loaded);
  loadedFonts.add(name);
  userFontNames.add(name);
};

/**
 * Hidrata todas las fuentes de usuario desde el store al arrancar la app
 * @param fonts Array de UserFont desde el store persistido
 */
export const hydrateUserFonts = async (
  fonts: Array<{ name: string; dataUrl: string; format: "truetype" | "opentype" | "woff" | "woff2" }>
): Promise<void> => {
  if (fonts.length === 0) return;
  await Promise.allSettled(
    fonts.map(f => loadUserFontFromDataUrl(f.name, f.dataUrl, f.format))
  );
};

/**
 * Carga una fuente (Google o personalizada) dinámicamente
 * @param fontName Nombre de la fuente a cargar
 * @returns Promise que se resuelve cuando la fuente está cargada
 */
export const loadFont = async (fontName: string): Promise<void> => {
  // Si es Arial o ya está cargada, no hacer nada
  if (fontName === "Arial" || loadedFonts.has(fontName)) {
    return Promise.resolve();
  }

  // Determinar si es Google Font o personalizada
  if (isCustomFont(fontName)) {
    return loadCustomFont(fontName);
  } else {
    return loadGoogleFont(fontName);
  }
};

/**
 * Valida si una fuente existe en la lista de fuentes disponibles
 * @param fontName Nombre de la fuente a validar
 * @returns true si existe, false si no
 */
export const isValidFont = (fontName: string): boolean => {
  return (
    GOOGLE_FONTS.includes(fontName as GoogleFont) ||
    CUSTOM_FONTS.includes(fontName as CustomFont) ||
    userFontNames.has(fontName)
  );
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

/**
 * Inicializa el sistema de fuentes personalizadas
 * Registra todas las fuentes personalizadas con sus rutas
 */
export const initializeCustomFonts = (): void => {
  // Registrar Atlanta College
  registerCustomFont(
    "Atlanta College",
    "/fonts/AtlantaCollege.ttf",
    "truetype"
  );

  // Registrar Basketball
  registerCustomFont("Basketball", "/fonts/Basketball.otf", "opentype");

  // Registrar Athletic
  registerCustomFont("Athletic", "/fonts/Athletic.ttf", "truetype");

  // Registrar Arial Black (puede estar instalada en el sistema, pero también podemos tener una copia local)
  registerCustomFont("Arial Black", "/fonts/ArialBlack.ttf", "truetype");

  console.log("✅ Sistema de fuentes personalizadas inicializado");
  console.log(`📦 Total de fuentes disponibles: ${ALL_FONTS.length}`);
  console.log(`   - Google Fonts: ${GOOGLE_FONTS.length}`);
  console.log(`   - Fuentes personalizadas: ${CUSTOM_FONTS.length}`);
};
