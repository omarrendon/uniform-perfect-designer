/**
 * Configuración global para exportación CMYK
 */

import type { ICCProfileName, GCRMethod } from './iccProfiles';
import type { PrintMarksOptions } from './printMarks';
import type { PreflightOptions } from './preflight';

export interface CMYKExportConfig {
  // Perfil ICC
  profile: ICCProfileName;

  // Control de color
  gcrMethod: GCRMethod;
  customTAC?: number;
  applyDotGain: boolean;

  // Marcas de impresión
  printMarks: PrintMarksOptions;

  // Preflight
  preflight: PreflightOptions;

  // Opciones de salida
  addPreflightReport: boolean; // Agregar reporte como página adicional
  fileName?: string;
}

/**
 * Configuración predeterminada para impresión offset en Europa
 */
export const DEFAULT_OFFSET_EU: CMYKExportConfig = {
  profile: 'FOGRA39',
  gcrMethod: 'medium',
  applyDotGain: true,
  printMarks: {
    addCropMarks: true,
    addRegistrationMarks: true,
    addColorBars: true,
    addBleedMarks: false,
    addJobInfo: true,
    bleedSize: 9, // 3mm
    markOffset: 6,
  },
  preflight: {
    minResolution: 300,
    requireCMYK: true,
    checkBleed: false,
    checkFonts: false,
  },
  addPreflightReport: false,
};

/**
 * Configuración para impresión offset en USA
 */
export const DEFAULT_OFFSET_US: CMYKExportConfig = {
  profile: 'SWOP',
  gcrMethod: 'medium',
  applyDotGain: true,
  printMarks: {
    addCropMarks: true,
    addRegistrationMarks: true,
    addColorBars: true,
    addBleedMarks: false,
    addJobInfo: true,
  },
  preflight: {
    minResolution: 300,
    requireCMYK: true,
  },
  addPreflightReport: false,
};

/**
 * Configuración para papel no estucado
 */
export const DEFAULT_UNCOATED: CMYKExportConfig = {
  profile: 'UncoatedFOGRA29',
  gcrMethod: 'heavy', // Más negro en papel no estucado
  applyDotGain: true,
  printMarks: {
    addCropMarks: true,
    addRegistrationMarks: true,
    addColorBars: true,
  },
  preflight: {
    minResolution: 300,
    requireCMYK: true,
  },
  addPreflightReport: false,
};

/**
 * Configuración para impresión digital (menos restricciones)
 */
export const DEFAULT_DIGITAL: CMYKExportConfig = {
  profile: 'FOGRA51',
  gcrMethod: 'light',
  applyDotGain: false, // Impresión digital tiene mejor control
  printMarks: {
    addCropMarks: true,
    addRegistrationMarks: false,
    addColorBars: false,
  },
  preflight: {
    minResolution: 300,
    requireCMYK: true,
  },
  addPreflightReport: false,
};

/**
 * Configuración máxima calidad (con todas las verificaciones)
 */
export const DEFAULT_PREMIUM: CMYKExportConfig = {
  profile: 'FOGRA51',
  gcrMethod: 'medium',
  applyDotGain: true,
  printMarks: {
    addCropMarks: true,
    addRegistrationMarks: true,
    addColorBars: true,
    addBleedMarks: true,
    addJobInfo: true,
  },
  preflight: {
    minResolution: 300,
    requireCMYK: true,
    checkBleed: true,
    checkFonts: true,
  },
  addPreflightReport: true,
};

/**
 * Presets disponibles
 */
export const CMYK_PRESETS = {
  'Offset Europa': DEFAULT_OFFSET_EU,
  'Offset USA': DEFAULT_OFFSET_US,
  'Papel No Estucado': DEFAULT_UNCOATED,
  'Digital': DEFAULT_DIGITAL,
  'Premium (Máxima Calidad)': DEFAULT_PREMIUM,
} as const;

export type CMYKPresetName = keyof typeof CMYK_PRESETS;

/**
 * Obtiene configuración por preset
 */
export const getCMYKPreset = (presetName: CMYKPresetName): CMYKExportConfig => {
  return { ...CMYK_PRESETS[presetName] };
};

/**
 * Configuración global (puede ser modificada por el usuario)
 */
let globalConfig: CMYKExportConfig = { ...DEFAULT_OFFSET_EU };

/**
 * Obtiene la configuración global actual
 */
export const getGlobalCMYKConfig = (): CMYKExportConfig => {
  return { ...globalConfig };
};

/**
 * Establece la configuración global
 */
export const setGlobalCMYKConfig = (config: Partial<CMYKExportConfig>): void => {
  globalConfig = {
    ...globalConfig,
    ...config,
  };
};

/**
 * Resetea la configuración global al preset por defecto
 */
export const resetCMYKConfig = (preset: CMYKPresetName = 'Offset Europa'): void => {
  globalConfig = getCMYKPreset(preset);
};
