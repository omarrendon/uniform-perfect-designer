/**
 * Utilidad para mapear tallas de playeras de diseño a moldes
 */

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
