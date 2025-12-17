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
