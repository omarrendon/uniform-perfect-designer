/**
 * Utilidad para mapear tallas de playeras de diseño a moldes
 */
import type { Size, SizeSpanish } from "../types";

/**
 * Alias aceptados en la columna `talla` del Excel → talla interna.
 * Cubre nomenclatura española (XCH…4XG) e inglesa (XS…4XL) en cualquier capitalización.
 */
const SIZE_ALIASES: Record<string, Size> = {
  // Español
  'XCH': 'XS',
  'CH': 'S',
  'M': 'M',
  'G': 'L',
  'XG': 'XL',
  '2XG': 'XXL',
  'XXG': 'XXL',
  '3XG': '3XL',
  '4XG': '4XL',
  // Inglés
  'XS': 'XS',
  'S': 'S',
  'L': 'L',
  'XL': 'XL',
  'XXL': 'XXL',
  '2XL': 'XXL',
  '3XL': '3XL',
  'XXXL': '3XL',
  '4XL': '4XL',
};

const SIZE_TO_SPANISH: Record<Size, SizeSpanish> = {
  'XS': 'XCH',
  'S': 'CH',
  'M': 'M',
  'L': 'G',
  'XL': 'XG',
  'XXL': '2XG',
  '3XL': '3XG',
  '4XL': '4XG',
};

/**
 * Normaliza cualquier alias de talla del Excel a la talla interna.
 * @returns la talla, o null si el valor no corresponde a ninguna talla conocida
 */
export const normalizeSize = (raw: string): Size | null =>
  SIZE_ALIASES[String(raw).toUpperCase().trim()] ?? null;

/**
 * Normaliza cualquier alias de talla del Excel a su nomenclatura española,
 * que es la key usada en `uniformSizesConfig`.
 */
export const toSpanishSize = (raw: string): SizeSpanish | null => {
  const size = normalizeSize(raw);
  return size ? SIZE_TO_SPANISH[size] : null;
};


/**
 * Mapeo de nomenclatura de tallas españolas a internacionales
 * para las playeras de diseño
 */
export const DESIGN_SIZE_MAP: Record<string, string> = {
  ch: "S", // Chica → S
  m: "S", // Mediana → S
  g: "M", // Grande → M
};

/**
 * Obtiene la ruta de la imagen de diseño según la talla
 * @param talla Talla en formato español (ch, m, g)
 * @returns Ruta de la imagen de diseño o null si no existe
 */
export const getDesignImagePath = (talla: string): string | null => {
  const tallaNormalized = talla.toLowerCase().trim();

  const designMap: Record<string, string> = {
    ch: "/moldes/PLAYERA TALLA CH.png",
    m: "/moldes/PLAYERA TALLA M.png",
    g: "/moldes/PLAYERA TALLA G.png",
  };

  return designMap[tallaNormalized] || null;
};

/**
 * Verifica si existe un diseño disponible para la talla especificada
 * @param talla Talla a verificar
 * @returns true si existe diseño, false si no
 */
export const hasDesignForSize = (talla: string): boolean => {
  const tallaNormalized = talla.toLowerCase().trim();
  return ["ch", "m", "g"].includes(tallaNormalized);
};

/**
 * Convierte talla española (ch, m, g) a talla internacional (S, M, L, etc.)
 * @param tallaEspañola Talla en español
 * @returns Talla internacional
 */
export const convertSpanishToInternationalSize = (
  tallaEspañola: string
): string => {
  const tallaNormalized = tallaEspañola.toLowerCase().trim();
  return DESIGN_SIZE_MAP[tallaNormalized] || tallaEspañola.toUpperCase();
};
