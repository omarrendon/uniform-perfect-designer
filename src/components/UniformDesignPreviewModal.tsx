import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect } from 'react-konva';
import useImage from 'use-image';
import { X, RotateCcw, Eye, EyeOff, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { UniformDesignConfig, TextDesignConfig, CmykColor } from '../types';
import { useDesignerStore } from '../store/desingerStore';
import { loadFont, GOOGLE_FONTS } from '../utils/fontLoader';
import { hexToCMYK, cmykToHex } from '../utils/colorConversion';

// Dimensiones de referencia (talla M Hombre)
const M_JERSEY_W = 568.63;
const M_JERSEY_H = 791.56;
const M_SHORTS_W = 863.6;
const M_SHORTS_H = 602.38;

// Factor de escala para el mini-canvas de preview
const DISPLAY_SCALE = 0.4;

const JERSEY_DW = Math.round(M_JERSEY_W * DISPLAY_SCALE); // ~227
const JERSEY_DH = Math.round(M_JERSEY_H * DISPLAY_SCALE); // ~317
const SHORTS_DW = Math.round(M_SHORTS_W * DISPLAY_SCALE); // ~345
const SHORTS_DH = Math.round(M_SHORTS_H * DISPLAY_SCALE); // ~241
const PAD = 16;

const STAGE_W = Math.max(
  PAD + JERSEY_DW + PAD + JERSEY_DW + PAD,
  PAD + SHORTS_DW + PAD + SHORTS_DW + PAD,
);
const STAGE_H = PAD + JERSEY_DH + PAD + SHORTS_DH + PAD;

const PIECES = {
  jerseyFront:  { x: PAD, y: PAD, width: JERSEY_DW, height: JERSEY_DH },
  jerseyBack:   { x: PAD + JERSEY_DW + PAD, y: PAD, width: JERSEY_DW, height: JERSEY_DH },
  shortsLeft:   { x: PAD, y: PAD + JERSEY_DH + PAD, width: SHORTS_DW, height: SHORTS_DH },
  shortsRight:  { x: PAD + SHORTS_DW + PAD, y: PAD + JERSEY_DH + PAD, width: SHORTS_DW, height: SHORTS_DH },
} as const;

// Posiciones iniciales basadas en los offsets de la talla M
export const DEFAULT_DESIGN_CONFIG: UniformDesignConfig = {
  jerseyFrontNumber: {
    enabled: true,
    relativeX: 330 / M_JERSEY_W,
    relativeY: 116 / M_JERSEY_H,
    fontFamily: 'Arial',
    fontSize: 116.76,
    fontColor: '#000000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  jerseyBackNumber: {
    enabled: true,
    relativeX: 148 / M_JERSEY_W,
    relativeY: 204 / M_JERSEY_H,
    fontFamily: 'Arial',
    fontSize: 319.02,
    fontColor: '#000000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  jerseyBackName: {
    enabled: true,
    relativeX: 189 / M_JERSEY_W,
    relativeY: 130 / M_JERSEY_H,
    fontFamily: 'Arial',
    fontSize: 94.59,
    fontColor: '#000000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  shortsNumber: {
    enabled: false,
    side: 'right',
    relativeX: 337 / M_SHORTS_W,
    relativeY: 308 / M_SHORTS_H,
    fontFamily: 'Arial',
    fontSize: 150.47,
    fontColor: '#000000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
};

// Etiquetas para cada elemento de diseño
const ELEMENT_LABELS: Record<keyof UniformDesignConfig, string> = {
  jerseyFrontNumber: 'Número — Playera Frente',
  jerseyBackNumber: 'Número — Playera Espalda',
  jerseyBackName: 'Nombre — Playera Espalda',
  shortsNumber: 'Número — Short',
};

// Texto de muestra para previsualizar
const SAMPLE_CONTENT: Record<keyof UniformDesignConfig, string> = {
  jerseyFrontNumber: '10',
  jerseyBackNumber: '10',
  jerseyBackName: 'GARCIA',
  shortsNumber: '10',
};

type DesignKey = keyof UniformDesignConfig;

// Fuentes deportivas más usadas (subconjunto de GOOGLE_FONTS)
const FEATURED_FONTS = [
  'Arial',
  'Impact',
  'Bebas Neue',
  'Black Ops One',
  'Anton',
  'Oswald',
  'Roboto Condensed',
  'Barlow Condensed',
  'Russo One',
  'Teko',
  'Bungee',
  'Bangers',
  'Graduate',
  'Orbitron',
  'Big Shoulders Display',
  'Rajdhani',
  'Montserrat',
  'Permanent Marker',
];

// ─── Subcomponente: imagen de pieza en Konva ─────────────────────────────────
const PieceImage: React.FC<{
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}> = ({ url, x, y, width, height, rotation = 0 }) => {
  const [img] = useImage(url);
  if (!img) return null;
  if (rotation === 0) {
    return <KonvaImage image={img} x={x} y={y} width={width} height={height} />;
  }

  return (
    <KonvaImage
      image={img}
      x={x + width / 2}
      y={y + height / 2}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
    />
  );
};

// ─── Panel de propiedades para un elemento de texto ──────────────────────────
interface TextSectionProps {
  label: string;
  configKey: DesignKey;
  config: TextDesignConfig & { side?: 'left' | 'right' };
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<TextDesignConfig & { side?: 'left' | 'right' }>) => void;
}

const TextSection: React.FC<TextSectionProps> = ({
  label, configKey, config, isSelected, onSelect, onChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const userFonts = useDesignerStore(s => s.userFonts);

  // Auto-expandir cuando está seleccionado
  useEffect(() => {
    if (isSelected) setExpanded(true);
  }, [isSelected]);

  return (
    <div style={{
      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '8px',
      transition: 'border-color 0.15s',
    }}>
      {/* Header de sección */}
      <div
        onClick={() => { onSelect(); setExpanded(v => !v); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: isSelected ? '#eff6ff' : '#f9fafb',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onChange({ enabled: !config.enabled }); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', padding: '2px',
            }}
            title={config.enabled ? 'Desactivar' : 'Activar'}
          >
            {config.enabled
              ? <Eye style={{ width: 16, height: 16, color: '#3b82f6' }} />
              : <EyeOff style={{ width: 16, height: 16, color: '#9ca3af' }} />
            }
          </button>
          <span style={{
            fontSize: '13px',
            fontWeight: isSelected ? '600' : '500',
            color: config.enabled ? '#1f2937' : '#9ca3af',
          }}>
            {label}
          </span>
        </div>
        {expanded
          ? <ChevronUp style={{ width: 14, height: 14, color: '#6b7280' }} />
          : <ChevronDown style={{ width: 14, height: 14, color: '#6b7280' }} />
        }
      </div>

      {/* Controles (expandibles) */}
      {expanded && config.enabled && (
        <div style={{ padding: '12px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Selector de lado para shorts */}
          {configKey === 'shortsNumber' && (
            <div>
              <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Lado del short</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['left', 'right'] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => onChange({ side })}
                    style={{
                      flex: 1, padding: '5px',
                      fontSize: '12px', fontWeight: '500',
                      border: '1px solid',
                      borderColor: (config as any).side === side ? '#3b82f6' : '#d1d5db',
                      backgroundColor: (config as any).side === side ? '#eff6ff' : 'white',
                      color: (config as any).side === side ? '#1d4ed8' : '#374151',
                      borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    {side === 'left' ? 'Izquierdo' : 'Derecho'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fuente */}
          <div>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Fuente</label>
            <select
              value={config.fontFamily}
              onChange={e => onChange({ fontFamily: e.target.value })}
              style={{
                width: '100%', padding: '5px 8px', fontSize: '13px',
                border: '1px solid #d1d5db', borderRadius: '6px',
                fontFamily: config.fontFamily,
              }}
            >
              {userFonts.length > 0 && (
                <optgroup label="Mis Fuentes">
                  {userFonts.map(f => (
                    <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.name}</option>
                  ))}
                </optgroup>
              )}
              {FEATURED_FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
              <optgroup label="Todas las fuentes">
                {GOOGLE_FONTS.filter(f => !FEATURED_FONTS.includes(f)).map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Tamaño */}
          <div>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Tamaño (px en talla M)
            </label>
            <input
              type="number"
              min={20}
              max={600}
              value={Math.round(config.fontSize)}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 20) onChange({ fontSize: val });
              }}
              style={{
                width: '100%', padding: '5px 8px', fontSize: '13px',
                border: '1px solid #d1d5db', borderRadius: '6px',
              }}
            />
          </div>

          {/* Color CMYK */}
          <div>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>Color (CMYK)</label>
            {(() => {
              const cmyk: CmykColor = config.fontColorCmyk ?? hexToCMYK(config.fontColor || '#000000');
              const channels: { key: keyof CmykColor; label: string; color: string }[] = [
                { key: 'c', label: 'C', color: '#06b6d4' },
                { key: 'm', label: 'M', color: '#ec4899' },
                { key: 'y', label: 'Y', color: '#eab308' },
                { key: 'k', label: 'K', color: '#374151' },
              ];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Preview swatch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      backgroundColor: config.fontColor || '#000000',
                      border: '1px solid #d1d5db', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {config.fontColor?.toUpperCase()}
                    </span>
                  </div>
                  {channels.map(({ key, label, color }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color, width: '12px', flexShrink: 0 }}>{label}</span>
                      <input
                        type="range" min="0" max="100"
                        value={cmyk[key]}
                        onChange={e => {
                          const newCmyk = { ...cmyk, [key]: Number(e.target.value) };
                          onChange({
                            fontColorCmyk: newCmyk,
                            fontColor: cmykToHex(newCmyk.c, newCmyk.m, newCmyk.y, newCmyk.k),
                          });
                        }}
                        style={{ flex: 1, accentColor: color, height: '4px' }}
                      />
                      <input
                        type="number" min="0" max="100"
                        value={cmyk[key]}
                        onChange={e => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value)));
                          const newCmyk = { ...cmyk, [key]: val };
                          onChange({
                            fontColorCmyk: newCmyk,
                            fontColor: cmykToHex(newCmyk.c, newCmyk.m, newCmyk.y, newCmyk.k),
                          });
                        }}
                        style={{
                          width: '44px', padding: '3px 4px', fontSize: '11px',
                          border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'right',
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Grosor */}
          <div>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Grosor</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['normal', 'bold'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => onChange({ fontWeight: w })}
                  style={{
                    flex: 1, padding: '5px',
                    fontSize: '12px',
                    fontWeight: w,
                    border: '1px solid',
                    borderColor: config.fontWeight === w ? '#3b82f6' : '#d1d5db',
                    backgroundColor: config.fontWeight === w ? '#eff6ff' : 'white',
                    color: config.fontWeight === w ? '#1d4ed8' : '#374151',
                    borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  {w === 'normal' ? 'Normal' : 'Negrita'}
                </button>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
            Arrastra el texto en el canvas para reposicionarlo
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface UniformDesignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniformDesignPreviewModal: React.FC<UniformDesignPreviewModalProps> = ({
  isOpen, onClose,
}) => {
  const { uniformTemplate, uniformDesignConfig, setUniformDesignConfig } = useDesignerStore();

  const [config, setConfig] = useState<UniformDesignConfig>(
    () => uniformDesignConfig ?? DEFAULT_DESIGN_CONFIG,
  );
  const [selectedKey, setSelectedKey] = useState<DesignKey | null>(null);
  const stageRef = useRef<any>(null);

  // Reiniciar config local al abrir
  useEffect(() => {
    if (isOpen) {
      setConfig(uniformDesignConfig ?? DEFAULT_DESIGN_CONFIG);
      setSelectedKey(null);
    }
  }, [isOpen, uniformDesignConfig]);

  // Cargar fuentes cuando cambia el config
  useEffect(() => {
    const fonts = [
      config.jerseyFrontNumber.fontFamily,
      config.jerseyBackNumber.fontFamily,
      config.jerseyBackName.fontFamily,
      config.shortsNumber.fontFamily,
    ];
    fonts.forEach(f => { if (f !== 'Arial') loadFont(f); });
  }, [
    config.jerseyFrontNumber.fontFamily,
    config.jerseyBackNumber.fontFamily,
    config.jerseyBackName.fontFamily,
    config.shortsNumber.fontFamily,
  ]);

  const updateElement = useCallback(<K extends DesignKey>(
    key: K,
    updates: Partial<UniformDesignConfig[K]>,
  ) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
    if (updates.fontFamily && (updates.fontFamily as string) !== 'Arial') {
      loadFont(updates.fontFamily as string);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setUniformDesignConfig(config);
    onClose();
  }, [config, setUniformDesignConfig, onClose]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_DESIGN_CONFIG);
  }, []);

  // Obtener pieza asociada a cada elemento
  const getPieceForKey = (key: DesignKey, cfg: UniformDesignConfig) => {
    if (key === 'jerseyFrontNumber') return PIECES.jerseyFront;
    if (key === 'jerseyBackNumber') return PIECES.jerseyBack;
    if (key === 'jerseyBackName') return PIECES.jerseyBack;
    if (key === 'shortsNumber') {
      return (cfg.shortsNumber as any).side === 'left' ? PIECES.shortsLeft : PIECES.shortsRight;
    }
    return PIECES.jerseyFront;
  };

  // Calcular posición de pantalla del texto desde posición relativa
  const getDisplayPos = (key: DesignKey, cfg: UniformDesignConfig) => {
    const piece = getPieceForKey(key, cfg);
    const el = cfg[key];
    const isShortRight = key === 'shortsNumber' && cfg.shortsNumber.side === 'right';
    const relX = isShortRight ? 1 - el.relativeX : el.relativeX;
    const relY = isShortRight ? 1 - el.relativeY : el.relativeY;

    return {
      x: piece.x + relX * piece.width,
      y: piece.y + relY * piece.height,
    };
  };

  // Calcular tamaño de fuente escalado para display
  const getDisplayFontSize = (el: TextDesignConfig) =>
    Math.max(10, Math.round(el.fontSize * DISPLAY_SCALE));

  if (!isOpen) return null;

  const imgs = uniformTemplate;

  const designKeys: DesignKey[] = [
    'jerseyFrontNumber',
    'jerseyBackNumber',
    'jerseyBackName',
    'shortsNumber',
  ];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '16px',
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35)',
          width: '95%', maxWidth: '1200px', maxHeight: '95vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Diseñar Uniforme
            </h2>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
              Arrastra los textos para posicionarlos — el diseño se aplicará a todos los uniformes del Excel
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px', borderRadius: '8px', border: 'none',
              backgroundColor: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X style={{ width: 18, height: 18, color: '#6b7280' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0,
        }}>
          {/* Canvas area */}
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            padding: '16px',
            overflow: 'auto',
          }}>
            <div>
              {/* Leyendas de piezas */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `${JERSEY_DW}px ${JERSEY_DW}px`,
                gap: `${PAD}px`,
                marginBottom: '4px',
                paddingLeft: `${PAD}px`,
              }}>
                {['Playera Frente', 'Playera Espalda'].map(label => (
                  <div key={label} style={{ textAlign: 'center', fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{label}</div>
                ))}
              </div>

              <Stage
                ref={stageRef}
                width={STAGE_W}
                height={STAGE_H}
                style={{ background: '#e5e7eb', borderRadius: '8px' }}
              >
                <Layer>
                  {/* Fondos de piezas */}
                  {Object.entries(PIECES).map(([key, p]) => (
                    <Rect
                      key={key}
                      x={p.x} y={p.y} width={p.width} height={p.height}
                      fill="#ffffff"
                      strokeWidth={1}
                      stroke="#d1d5db"
                      cornerRadius={4}
                    />
                  ))}

                  {/* Imágenes del template */}
                  {imgs?.jerseyFront && (
                    <PieceImage url={imgs.jerseyFront} {...PIECES.jerseyFront} />
                  )}
                  {imgs?.jerseyBack && (
                    <PieceImage url={imgs.jerseyBack} {...PIECES.jerseyBack} />
                  )}
                  {imgs?.shortsLeft && (
                    <PieceImage url={imgs.shortsLeft} {...PIECES.shortsLeft} />
                  )}
                  {imgs?.shortsRight && (
                    <PieceImage url={imgs.shortsRight} {...PIECES.shortsRight} rotation={180} />
                  )}

                  {/* Textos draggables */}
                  {designKeys.map(key => {
                    const el = config[key];
                    if (!el.enabled) return null;

                    const piece = getPieceForKey(key, config);
                    const pos = getDisplayPos(key, config);
                    const displayFontSize = getDisplayFontSize(el);
                    const isSelected = selectedKey === key;
                    const isShortRight = key === 'shortsNumber' && config.shortsNumber.side === 'right';

                    return (
                      <KonvaText
                        key={key}
                        x={pos.x}
                        y={pos.y}
                        text={SAMPLE_CONTENT[key]}
                        fontSize={displayFontSize}
                        fontFamily={el.fontFamily}
                        fill={el.fontColor}
                        fontStyle={el.fontWeight === 'bold' ? 'bold' : 'normal'}
                        rotation={isShortRight ? 180 : 0}
                        draggable
                        strokeWidth={isSelected ? 1 : 0}
                        stroke={isSelected ? '#3b82f6' : undefined}
                        onClick={() => setSelectedKey(isSelected ? null : key)}
                        onTap={() => setSelectedKey(isSelected ? null : key)}
                        dragBoundFunc={(rawPos) => {
                          // Clampar dentro de la pieza
                          const clampedX = Math.max(piece.x, Math.min(piece.x + piece.width - 4, rawPos.x));
                          const clampedY = Math.max(piece.y, Math.min(piece.y + piece.height - displayFontSize, rawPos.y));
                          return { x: clampedX, y: clampedY };
                        }}
                        onDragEnd={e => {
                          let newRelX = Math.max(0, Math.min(1, (e.target.x() - piece.x) / piece.width));
                          let newRelY = Math.max(0, Math.min(1, (e.target.y() - piece.y) / piece.height));

                          // El short derecho se previsualiza rotado 180°, por eso guardamos en espacio no rotado.
                          if (key === 'shortsNumber' && config.shortsNumber.side === 'right') {
                            newRelX = 1 - newRelX;
                            newRelY = 1 - newRelY;
                          }

                          updateElement(key, { relativeX: newRelX, relativeY: newRelY } as any);
                        }}
                      />
                    );
                  })}
                </Layer>
              </Stage>

              {/* Leyendas de shorts */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `${SHORTS_DW}px ${SHORTS_DW}px`,
                gap: `${PAD}px`,
                marginTop: '4px',
                paddingLeft: `${PAD}px`,
              }}>
                {['Short Izquierdo', 'Short Derecho'].map(label => (
                  <div key={label} style={{ textAlign: 'center', fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{label}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel de propiedades */}
          <div style={{
            width: '300px',
            flexShrink: 0,
            borderLeft: '1px solid #e5e7eb',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: 0 }}>
                Configuración de textos
              </p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
                Haz clic en un texto del canvas o en una sección para editar
              </p>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
              {designKeys.map(key => (
                <TextSection
                  key={key}
                  label={ELEMENT_LABELS[key]}
                  configKey={key}
                  config={config[key] as any}
                  isSelected={selectedKey === key}
                  onSelect={() => setSelectedKey(key)}
                  onChange={updates => updateElement(key, updates as any)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <button
            onClick={handleReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', fontSize: '13px', fontWeight: '500',
              border: '1px solid #d1d5db', borderRadius: '8px',
              backgroundColor: 'white', color: '#374151', cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            Restablecer
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: '500',
                border: '1px solid #d1d5db', borderRadius: '8px',
                backgroundColor: 'white', color: '#374151', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', fontSize: '13px', fontWeight: '600',
                border: 'none', borderRadius: '8px',
                backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer',
              }}
            >
              <Check style={{ width: 14, height: 14 }} />
              Confirmar Diseño
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
