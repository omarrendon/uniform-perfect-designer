/**
 * Perfiles ICC para conversión profesional RGB→CMYK
 * Implementación basada en estándares ISO 12647-2
 */

export type ICCProfileName =
  | 'FOGRA39' // Coated FOGRA39 (ISO 12647-2:2004) - Papel estucado Europa
  | 'FOGRA51' // Coated FOGRA51 (ISO 12647-2:2013) - Papel estucado moderno
  | 'SWOP'    // SWOP (Specifications for Web Offset Publications) - USA
  | 'JapanColor2011' // Japan Color 2011 - Estándar japonés
  | 'UncoatedFOGRA29'; // Uncoated FOGRA29 - Papel no estucado

export type GCRMethod =
  | 'none'    // Sin GCR (UCR tradicional)
  | 'light'   // GCR ligero (más color, menos negro)
  | 'medium'  // GCR medio (balance)
  | 'heavy'   // GCR pesado (más negro, menos CMY)
  | 'maximum'; // GCR máximo (máximo negro posible)

export interface ICCProfile {
  name: ICCProfileName;
  displayName: string;
  description: string;
  maxTAC: number; // Total Area Coverage máximo (%)
  blackGeneration: GCRMethod;
  blackInkLimit: number; // Límite de tinta negra (%)
  dotGain: {
    c: number;
    m: number;
    y: number;
    k: number;
  };
  // Curvas de compensación para cada canal
  compensationCurves: {
    c: (value: number) => number;
    m: (value: number) => number;
    y: (value: number) => number;
    k: (value: number) => number;
  };
}

/**
 * Perfil FOGRA39 (Coated FOGRA39)
 * Papel estucado brillante, offset
 * ISO 12647-2:2004
 */
const FOGRA39_PROFILE: ICCProfile = {
  name: 'FOGRA39',
  displayName: 'Coated FOGRA39 (ISO 12647-2:2004)',
  description: 'Papel estucado brillante - Europa',
  maxTAC: 330,
  blackGeneration: 'medium',
  blackInkLimit: 100,
  dotGain: {
    c: 16,
    m: 14,
    y: 14,
    k: 18,
  },
  compensationCurves: {
    c: (v) => v * 1.05, // Compensación para cyan
    m: (v) => v * 1.02, // Compensación para magenta
    y: (v) => v * 1.00, // Yellow sin compensación
    k: (v) => v * 1.08, // Negro con mayor compensación
  },
};

/**
 * Perfil FOGRA51 (Coated FOGRA51)
 * Papel estucado moderno
 * ISO 12647-2:2013
 */
const FOGRA51_PROFILE: ICCProfile = {
  name: 'FOGRA51',
  displayName: 'Coated FOGRA51 (ISO 12647-2:2013)',
  description: 'Papel estucado moderno - Europa',
  maxTAC: 320,
  blackGeneration: 'medium',
  blackInkLimit: 95,
  dotGain: {
    c: 14,
    m: 12,
    y: 12,
    k: 16,
  },
  compensationCurves: {
    c: (v) => v * 1.03,
    m: (v) => v * 1.01,
    y: (v) => v * 1.00,
    k: (v) => v * 1.06,
  },
};

/**
 * Perfil SWOP
 * Estándar americano para offset
 */
const SWOP_PROFILE: ICCProfile = {
  name: 'SWOP',
  displayName: 'SWOP 2006 (USA)',
  description: 'Estándar americano para offset',
  maxTAC: 300,
  blackGeneration: 'medium',
  blackInkLimit: 95,
  dotGain: {
    c: 18,
    m: 16,
    y: 16,
    k: 20,
  },
  compensationCurves: {
    c: (v) => v * 1.06,
    m: (v) => v * 1.03,
    y: (v) => v * 1.01,
    k: (v) => v * 1.09,
  },
};

/**
 * Perfil Japan Color 2011
 * Estándar japonés
 */
const JAPAN_COLOR_2011_PROFILE: ICCProfile = {
  name: 'JapanColor2011',
  displayName: 'Japan Color 2011',
  description: 'Estándar japonés para impresión offset',
  maxTAC: 320,
  blackGeneration: 'light',
  blackInkLimit: 90,
  dotGain: {
    c: 15,
    m: 13,
    y: 13,
    k: 17,
  },
  compensationCurves: {
    c: (v) => v * 1.04,
    m: (v) => v * 1.02,
    y: (v) => v * 1.00,
    k: (v) => v * 1.07,
  },
};

/**
 * Perfil Uncoated FOGRA29
 * Papel no estucado
 */
const UNCOATED_FOGRA29_PROFILE: ICCProfile = {
  name: 'UncoatedFOGRA29',
  displayName: 'Uncoated FOGRA29',
  description: 'Papel no estucado - Europa',
  maxTAC: 280,
  blackGeneration: 'heavy',
  blackInkLimit: 95,
  dotGain: {
    c: 22,
    m: 20,
    y: 20,
    k: 25,
  },
  compensationCurves: {
    c: (v) => v * 1.08,
    m: (v) => v * 1.05,
    y: (v) => v * 1.02,
    k: (v) => v * 1.12,
  },
};

/**
 * Mapa de perfiles disponibles
 */
export const ICC_PROFILES: Record<ICCProfileName, ICCProfile> = {
  FOGRA39: FOGRA39_PROFILE,
  FOGRA51: FOGRA51_PROFILE,
  SWOP: SWOP_PROFILE,
  JapanColor2011: JAPAN_COLOR_2011_PROFILE,
  UncoatedFOGRA29: UNCOATED_FOGRA29_PROFILE,
};

/**
 * Obtiene un perfil ICC por nombre
 */
export const getICCProfile = (name: ICCProfileName): ICCProfile => {
  return ICC_PROFILES[name];
};

/**
 * Lista de todos los perfiles disponibles
 */
export const getAvailableProfiles = (): ICCProfile[] => {
  return Object.values(ICC_PROFILES);
};

/**
 * Porcentajes de GCR por método
 */
export const GCR_PERCENTAGES: Record<GCRMethod, number> = {
  none: 0,
  light: 25,
  medium: 50,
  heavy: 75,
  maximum: 100,
};

/**
 * Calcula el negro (K) usando GCR
 * @param c Cyan (0-100)
 * @param m Magenta (0-100)
 * @param y Yellow (0-100)
 * @param method Método GCR
 * @returns Valor de K calculado
 */
export const calculateGCRBlack = (
  c: number,
  m: number,
  y: number,
  method: GCRMethod
): number => {
  // Encontrar el mínimo de CMY
  const minCMY = Math.min(c, m, y);

  // Aplicar porcentaje de GCR
  const gcrPercentage = GCR_PERCENTAGES[method];
  const k = (minCMY * gcrPercentage) / 100;

  return k;
};

/**
 * Aplica GCR a los valores CMYK
 */
export const applyGCR = (
  c: number,
  m: number,
  y: number,
  k: number,
  method: GCRMethod
): { c: number; m: number; y: number; k: number } => {
  // Calcular el negro adicional por GCR
  const gcrBlack = calculateGCRBlack(c, m, y, method);

  // Remover el componente gris de CMY
  const newC = Math.max(0, c - gcrBlack);
  const newM = Math.max(0, m - gcrBlack);
  const newY = Math.max(0, y - gcrBlack);
  const newK = Math.min(100, k + gcrBlack);

  return {
    c: newC,
    m: newM,
    y: newY,
    k: newK,
  };
};

/**
 * Aplica límite de TAC (Total Area Coverage)
 */
export const applyTACLimit = (
  c: number,
  m: number,
  y: number,
  k: number,
  maxTAC: number
): { c: number; m: number; y: number; k: number } => {
  const currentTAC = c + m + y + k;

  if (currentTAC <= maxTAC) {
    return { c, m, y, k };
  }

  // Reducir proporcionalmente
  const scale = maxTAC / currentTAC;

  return {
    c: c * scale,
    m: m * scale,
    y: y * scale,
    k: k * scale,
  };
};

/**
 * Aplica compensación de dot gain
 */
export const applyDotGainCompensation = (
  c: number,
  m: number,
  y: number,
  k: number,
  profile: ICCProfile
): { c: number; m: number; y: number; k: number } => {
  return {
    c: Math.min(100, profile.compensationCurves.c(c)),
    m: Math.min(100, profile.compensationCurves.m(m)),
    y: Math.min(100, profile.compensationCurves.y(y)),
    k: Math.min(100, profile.compensationCurves.k(k)),
  };
};
