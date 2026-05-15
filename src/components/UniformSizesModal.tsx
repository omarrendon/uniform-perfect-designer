import React, { useState, useRef } from "react";
import { X, Upload, Check, AlertCircle, FileUp, Palette } from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import { validateExcelFile } from "../utils/excelReader";
import { processExcelFile } from "../utils/excelProcessor";
import type { ExcelProcessorCallbacks } from "../utils/excelProcessor";
import { UniformDesignPreviewModal } from "./UniformDesignPreviewModal";

interface UniformSizesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImageSlot = 'jerseyFront' | 'jerseyBack' | 'shortsLeft' | 'shortsRight';

const SLOT_LABELS: Record<ImageSlot, string> = {
  jerseyFront: 'Playera Delantera',
  jerseyBack: 'Playera Trasera',
  shortsLeft: 'Short Izquierdo',
  shortsRight: 'Short Derecho',
};

export const UniformSizesModal: React.FC<UniformSizesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [showDesignModal, setShowDesignModal] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const { uniformTemplate, setUniformTemplate, isTemplateComplete } = useDesignerStore();

  if (!isOpen) return null;

  const handleImageUpload = (slot: ImageSlot, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUniformTemplate({ [slot]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateExcelFile(file)) {
      alert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)');
      return;
    }

    setExcelFile(file);
  };

  const handleProcessExcel = async () => {
    if (!excelFile) {
      alert('Por favor selecciona un archivo Excel primero');
      return;
    }

    const callbacks: ExcelProcessorCallbacks = {
      onError: (title, message, details) => {
        setIsProcessing(false);
        let errorText = `❌ ${title}\n\n${message}`;
        if (details && details.length > 0) {
          errorText += '\n\nDetalles:\n' + details.join('\n');
        }
        alert(errorText);
      },
      onProgress: (current, total) => {
        setProcessingProgress({ current, total });
      },
      onStart: () => {
        setIsProcessing(true);
        setProcessingProgress({ current: 0, total: 0 });
      },
      onComplete: (summary) => {
        setIsProcessing(false);
        alert(
          `✅ ¡Carga completada exitosamente!\n\n` +
          `📊 Elementos procesados: ${summary.totalElements}\n` +
          `📄 Páginas utilizadas: ${summary.pagesUsed}\n\n` +
          `Los uniformes ya están listos en el canvas.`
        );
        onClose();
      },
    };

    await processExcelFile(excelFile, callbacks);
  };

  const templateComplete = isTemplateComplete();
  const uploadedCount = [
    uniformTemplate?.jerseyFront,
    uniformTemplate?.jerseyBack,
    uniformTemplate?.shortsLeft,
    uniformTemplate?.shortsRight,
  ].filter(Boolean).length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
              Plantilla de Uniforme
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Carga una vez las 4 imágenes del uniforme — se escalan automáticamente a cada talla
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px', borderRadius: '8px', border: 'none',
              backgroundColor: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          </button>
        </div>

        {/* Status */}
        <div style={{ padding: '16px 24px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {templateComplete ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', backgroundColor: '#d1fae5',
              border: '1px solid #10b981', borderRadius: '8px',
            }}>
              <Check style={{ width: '18px', height: '18px', color: '#10b981' }} />
              <span style={{ fontSize: '14px', color: '#065f46', fontWeight: '600' }}>
                Plantilla completa — lista para usar en la carga masiva
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b', borderRadius: '8px',
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
              <span style={{ fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
                {uploadedCount}/4 imágenes cargadas — faltan {4 - uploadedCount} para continuar
              </span>
            </div>
          )}

          {templateComplete && (
            <button
              onClick={() => setShowDesignModal(true)}
              style={{
                marginTop: '10px',
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '10px 16px',
                backgroundColor: '#7c3aed', color: 'white',
                border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              <Palette style={{ width: '18px', height: '18px' }} />
              Armar posiciones de números y nombres
            </button>
          )}
        </div>

        {/* Image Uploads */}
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}>
            {(Object.keys(SLOT_LABELS) as ImageSlot[]).map(slot => {
              const imageUrl = uniformTemplate?.[slot];
              return (
                <div key={slot}>
                  <label style={{
                    display: 'block', fontSize: '14px', fontWeight: '600',
                    color: '#374151', marginBottom: '8px',
                  }}>
                    {SLOT_LABELS[slot]}
                  </label>
                  <div style={{
                    border: imageUrl ? '2px solid #10b981' : '2px dashed #d1d5db',
                    borderRadius: '12px', padding: '16px', textAlign: 'center',
                    backgroundColor: imageUrl ? '#f0fdf4' : 'white',
                    transition: 'all 0.2s',
                  }}>
                    {imageUrl ? (
                      <div>
                        <img
                          src={imageUrl}
                          alt={SLOT_LABELS[slot]}
                          style={{
                            width: '100%', height: '150px',
                            objectFit: 'contain', marginBottom: '12px', borderRadius: '8px',
                          }}
                        />
                        <label style={{
                          display: 'inline-block', padding: '8px 16px',
                          backgroundColor: '#3b82f6', color: 'white',
                          borderRadius: '6px', fontSize: '13px',
                          fontWeight: '500', cursor: 'pointer',
                        }}>
                          Cambiar imagen
                          <input
                            type="file" accept="image/*"
                            onChange={(e) => handleImageUpload(slot, e)}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'block' }}>
                        <Upload style={{ width: '40px', height: '40px', color: '#9ca3af', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Haz clic para subir
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                          PNG, JPG, WEBP
                        </p>
                        <input
                          type="file" accept="image/*"
                          onChange={(e) => handleImageUpload(slot, e)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '500', marginBottom: '16px' }}>
            ⚠️ Las imágenes se mantienen en memoria durante la sesión actual. Al refrescar la página deberás cargarlas nuevamente.
          </p>

          {/* Excel upload */}
          <div style={{
            marginBottom: '16px', padding: '16px',
            backgroundColor: 'white', borderRadius: '8px',
            border: '2px dashed #d1d5db',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <FileUp style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                  Cargar Datos desde Excel
                </h4>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  Sube un archivo .xlsx o .xls con los datos de los uniformes
                </p>
              </div>
            </div>

            <input
              ref={excelInputRef} type="file" accept=".xlsx,.xls"
              onChange={handleExcelFileChange} style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => excelInputRef.current?.click()}
                style={{
                  flex: 1, padding: '8px 16px',
                  backgroundColor: excelFile ? '#f3f4f6' : '#10b981',
                  color: excelFile ? '#374151' : 'white',
                  border: excelFile ? '1px solid #d1d5db' : 'none',
                  borderRadius: '6px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                {excelFile ? `📄 ${excelFile.name}` : 'Seleccionar Archivo'}
              </button>

              {excelFile && (
                <button
                  onClick={handleProcessExcel}
                  disabled={!templateComplete}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: templateComplete ? '#3b82f6' : '#9ca3af',
                    color: 'white', border: 'none',
                    borderRadius: '6px', fontSize: '13px',
                    fontWeight: '600',
                    cursor: templateComplete ? 'pointer' : 'not-allowed',
                  }}
                >
                  Procesar
                </button>
              )}
            </div>

            {!templateComplete && excelFile && (
              <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '8px' }}>
                Completa las 4 imágenes de la plantilla antes de procesar el Excel
              </p>
            )}

            <div style={{
              marginTop: '12px', padding: '10px',
              backgroundColor: '#eff6ff', borderRadius: '6px',
              border: '1px solid #bfdbfe',
            }}>
              <p style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>
                <strong>Columnas requeridas:</strong> nombre, talla
              </p>
              <p style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>
                <strong>Columnas opcionales:</strong> genero, numero, fuente, color
              </p>
              <p style={{ fontSize: '10px', color: '#1e40af' }}>
                <strong>Tamaños de texto:</strong> tamano_numero_frente, tamano_numero_espalda, tamano_nombre_espalda, tamano_numero_short
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px 24px',
              backgroundColor: '#6b7280', color: 'white',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Loading Overlay */}
        {isProcessing && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: '16px', zIndex: 10,
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '12px',
              padding: '32px', maxWidth: '400px', width: '90%',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '64px', height: '64px', margin: '0 auto 16px',
                  border: '4px solid #e5e7eb', borderTopColor: '#3b82f6',
                  borderRadius: '50%', animation: 'spin 1s linear infinite',
                }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                  Procesando Excel...
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  Por favor espera mientras procesamos los datos
                </p>
              </div>

              {processingProgress.total > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>Progreso</span>
                    <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>
                      {processingProgress.current} / {processingProgress.total}
                    </span>
                  </div>
                  <div style={{
                    width: '100%', backgroundColor: '#e5e7eb',
                    borderRadius: '9999px', height: '8px', overflow: 'hidden',
                  }}>
                    <div style={{
                      background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                      height: '100%', borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                      width: `${(processingProgress.current / processingProgress.total) * 100}%`,
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <UniformDesignPreviewModal
        isOpen={showDesignModal}
        onClose={() => setShowDesignModal(false)}
      />
    </div>
  );
};
