import React, { useState } from "react";
import { X, Upload, Check, AlertCircle } from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish } from "../types";

interface UniformSizesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SIZES: SizeSpanish[] = ['XCH', 'CH', 'M', 'G', 'XG', '2XG', '3XG'];

const SIZE_LABELS: Record<SizeSpanish, string> = {
  'XCH': 'Extra Chica',
  'CH': 'Chica',
  'M': 'Mediana',
  'G': 'Grande',
  'XG': 'Extra Grande',
  '2XG': '2 Extra Grande',
  '3XG': '3 Extra Grande',
};

export const UniformSizesModal: React.FC<UniformSizesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentSize, setCurrentSize] = useState<SizeSpanish>('M');
  const { uniformSizesConfig, setUniformSizeImages, isSizeComplete } = useDesignerStore();

  if (!isOpen) return null;

  const handleImageUpload = (type: 'jerseyFront' | 'jerseyBack' | 'shorts', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Convertir a base64 SIN compresión para mantener calidad original
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      console.log(`Imagen cargada: ${type} para talla ${currentSize}`);
      setUniformSizeImages(currentSize, { [type]: base64String });
    };
    reader.readAsDataURL(file);
  };

  const currentImages = uniformSizesConfig[currentSize] || {};
  const isComplete = isSizeComplete(currentSize);

  // Contar cuántas tallas están completas
  const completedSizes = SIZES.filter(size => isSizeComplete(size)).length;
  const totalImages = completedSizes * 3;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          maxWidth: '900px',
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
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '4px',
            }}>
              📏 Configuración de Uniformes por Talla
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
            }}>
              Sube las imágenes para cada talla que vas a utilizar
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f3f4f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Progreso total: {totalImages}/21 imágenes
            </span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>
              {completedSizes}/7 tallas completas
            </span>
          </div>
          <div style={{
            width: '100%',
            backgroundColor: '#e5e7eb',
            borderRadius: '9999px',
            height: '8px',
            overflow: 'hidden',
          }}>
            <div
              style={{
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                height: '100%',
                borderRadius: '9999px',
                transition: 'width 0.3s ease',
                width: `${(totalImages / 21) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Size Tabs */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto',
          display: 'flex',
          gap: '8px',
        }}>
          {SIZES.map(size => {
            const complete = isSizeComplete(size);
            const isActive = size === currentSize;

            return (
              <button
                key={size}
                onClick={() => setCurrentSize(size)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: isActive ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  backgroundColor: isActive ? '#eff6ff' : 'white',
                  color: isActive ? '#3b82f6' : '#6b7280',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                }}
              >
                {size}
                {complete && (
                  <Check style={{
                    width: '16px',
                    height: '16px',
                    color: '#10b981',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px',
            }}>
              Talla {currentSize} ({SIZE_LABELS[currentSize]})
            </h3>
            {isComplete ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#d1fae5',
                border: '1px solid #10b981',
                borderRadius: '8px',
              }}>
                <Check style={{ width: '16px', height: '16px', color: '#10b981' }} />
                <span style={{ fontSize: '14px', color: '#065f46', fontWeight: '500' }}>
                  Completo (3/3 imágenes)
                </span>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
              }}>
                <AlertCircle style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                <span style={{ fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
                  Faltan {3 - Object.values(currentImages).filter(Boolean).length} imágenes
                </span>
              </div>
            )}
          </div>

          {/* Image Uploads */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}>
            {/* Playera Delantera */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Playera Delantera
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: currentImages.jerseyFront ? '#f9fafb' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {currentImages.jerseyFront ? (
                  <div>
                    <img
                      src={currentImages.jerseyFront}
                      alt="Playera Delantera"
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'contain',
                        marginBottom: '12px',
                        borderRadius: '8px',
                      }}
                    />
                    <label
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('jerseyFront', e)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload style={{
                      width: '48px',
                      height: '48px',
                      color: '#9ca3af',
                      margin: '0 auto 12px',
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '8px',
                    }}>
                      Haz clic para subir
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload('jerseyFront', e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Playera Trasera */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Playera Trasera
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: currentImages.jerseyBack ? '#f9fafb' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {currentImages.jerseyBack ? (
                  <div>
                    <img
                      src={currentImages.jerseyBack}
                      alt="Playera Trasera"
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'contain',
                        marginBottom: '12px',
                        borderRadius: '8px',
                      }}
                    />
                    <label
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('jerseyBack', e)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload style={{
                      width: '48px',
                      height: '48px',
                      color: '#9ca3af',
                      margin: '0 auto 12px',
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '8px',
                    }}>
                      Haz clic para subir
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload('jerseyBack', e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Short */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Short
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: currentImages.shorts ? '#f9fafb' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {currentImages.shorts ? (
                  <div>
                    <img
                      src={currentImages.shorts}
                      alt="Short"
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'contain',
                        marginBottom: '12px',
                        borderRadius: '8px',
                      }}
                    />
                    <label
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('shorts', e)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload style={{
                      width: '48px',
                      height: '48px',
                      color: '#9ca3af',
                      margin: '0 auto 12px',
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '8px',
                    }}>
                      Haz clic para subir
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload('shorts', e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
              💡 Solo las tallas con las 3 imágenes estarán disponibles en la carga masiva
            </p>
            <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '500' }}>
              ⚠️ Las imágenes se mantienen en memoria durante la sesión actual. Al refrescar la página deberás cargarlas nuevamente.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
