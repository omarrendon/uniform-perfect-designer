import React, { useState, useRef } from "react";
import { X, Upload, Check, AlertCircle, FileUp } from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import type { SizeSpanish, Gender } from "../types";
import { validateExcelFile } from "../utils/excelReader";
import { processExcelFile } from "../utils/excelProcessor";
import type { ExcelProcessorCallbacks } from "../utils/excelProcessor";

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
  const [currentGender, setCurrentGender] = useState<Gender>('Hombre');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const excelInputRef = useRef<HTMLInputElement>(null);
  const { uniformSizesConfig, setUniformSizeImages, isSizeComplete } = useDesignerStore();

  if (!isOpen) return null;

  const handleImageUpload = (type: 'jerseyFront' | 'jerseyBack' | 'shortsLeft' | 'shortsRight', event: React.ChangeEvent<HTMLInputElement>) => {
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
      // Crear compound key: "H-M", "M-XG", etc.
      const genderPrefix = currentGender === 'Hombre' ? 'H' : 'M';
      const sizeKey = `${genderPrefix}-${currentSize}`;
      console.log(`Imagen cargada: ${type} para ${currentGender} talla ${currentSize} (key: ${sizeKey})`);
      setUniformSizeImages(sizeKey, { [type]: base64String });
    };
    reader.readAsDataURL(file);
  };

  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo Excel
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

    // Definir callbacks para manejar el proceso
    const callbacks: ExcelProcessorCallbacks = {
      onError: (title, message, details) => {
        setIsProcessing(false);

        // Mostrar error al usuario
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
        // No cerrar el modal para mostrar el progreso
      },

      onComplete: (summary) => {
        setIsProcessing(false);

        // Mostrar mensaje de éxito
        alert(
          `✅ ¡Carga completada exitosamente!\n\n` +
          `📊 Elementos procesados: ${summary.totalElements}\n` +
          `📄 Páginas utilizadas: ${summary.pagesUsed}\n\n` +
          `Los uniformes ya están listos en el canvas.`
        );

        // Cerrar el modal después de completar
        onClose();
      },
    };

    // Procesar el archivo Excel
    await processExcelFile(excelFile, callbacks);
  };

  // Crear compound key para obtener las imágenes del género y talla actual
  const genderPrefix = currentGender === 'Hombre' ? 'H' : 'M';
  const currentSizeKey = `${genderPrefix}-${currentSize}`;
  const currentImages = uniformSizesConfig[currentSizeKey] || {};
  const isComplete = isSizeComplete(currentSizeKey);

  // Contar cuántas tallas están completas (considerando ambos géneros)
  const allSizeKeys = SIZES.flatMap(size => [`H-${size}`, `M-${size}`]);
  const completedSizes = allSizeKeys.filter(key => isSizeComplete(key)).length;
  const totalImages = completedSizes * 4;

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
              Progreso total: {totalImages}/56 imágenes
            </span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>
              {completedSizes}/14 tallas completas (7 Hombre + 7 Mujer)
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
                width: `${(totalImages / 56) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Gender Selection */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '10px',
          }}>
            Género del uniforme:
          </label>
          <div style={{
            display: 'flex',
            gap: '12px',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: currentGender === 'Hombre' ? '2px solid #3b82f6' : '1px solid #d1d5db',
              backgroundColor: currentGender === 'Hombre' ? '#eff6ff' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: currentGender === 'Hombre' ? '600' : '500',
              color: currentGender === 'Hombre' ? '#3b82f6' : '#6b7280',
            }}>
              <input
                type="radio"
                name="gender"
                value="Hombre"
                checked={currentGender === 'Hombre'}
                onChange={(e) => setCurrentGender(e.target.value as Gender)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '14px' }}>👔 Hombre</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: currentGender === 'Mujer' ? '2px solid #3b82f6' : '1px solid #d1d5db',
              backgroundColor: currentGender === 'Mujer' ? '#eff6ff' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: currentGender === 'Mujer' ? '600' : '500',
              color: currentGender === 'Mujer' ? '#3b82f6' : '#6b7280',
            }}>
              <input
                type="radio"
                name="gender"
                value="Mujer"
                checked={currentGender === 'Mujer'}
                onChange={(e) => setCurrentGender(e.target.value as Gender)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '14px' }}>👗 Mujer</span>
            </label>
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
              {currentGender === 'Hombre' ? '👔' : '👗'} {currentGender} - Talla {currentSize} ({SIZE_LABELS[currentSize]})
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
                  Completo (4/4 imágenes)
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
                  Faltan {4 - Object.values(currentImages).filter(Boolean).length} imágenes
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

            {/* Short Izquierdo */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Short Izquierdo
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: currentImages.shortsLeft ? '#f9fafb' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {currentImages.shortsLeft ? (
                  <div>
                    <img
                      src={currentImages.shortsLeft}
                      alt="Short Izquierdo"
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
                        onChange={(e) => handleImageUpload('shortsLeft', e)}
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
                      onChange={(e) => handleImageUpload('shortsLeft', e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Short Derecho */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}>
                Short Derecho
              </label>
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: currentImages.shortsRight ? '#f9fafb' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {currentImages.shortsRight ? (
                  <div>
                    <img
                      src={currentImages.shortsRight}
                      alt="Short Derecho"
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
                        onChange={(e) => handleImageUpload('shortsRight', e)}
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
                      onChange={(e) => handleImageUpload('shortsRight', e)}
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
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
              💡 Solo las tallas con las 4 imágenes estarán disponibles en la carga masiva
            </p>
            <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '500' }}>
              ⚠️ Las imágenes se mantienen en memoria durante la sesión actual. Al refrescar la página deberás cargarlas nuevamente.
            </p>
          </div>

          {/* Sección de carga de Excel */}
          <div style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
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
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => excelInputRef.current?.click()}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  backgroundColor: excelFile ? '#f3f4f6' : '#10b981',
                  color: excelFile ? '#374151' : 'white',
                  border: excelFile ? '1px solid #d1d5db' : 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {excelFile ? `📄 ${excelFile.name}` : 'Seleccionar Archivo'}
              </button>

              {excelFile && (
                <button
                  onClick={handleProcessExcel}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Procesar
                </button>
              )}
            </div>

            <div style={{
              marginTop: '12px',
              padding: '10px',
              backgroundColor: '#eff6ff',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
            }}>
              <p style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>
                <strong>Columnas requeridas:</strong> nombre, talla
              </p>
              <p style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>
                <strong>Columnas opcionales:</strong> genero (Hombre/Mujer), numero, fuente
              </p>
              <p style={{ fontSize: '10px', color: '#1e40af', marginBottom: '2px' }}>
                <strong>Personalización:</strong> tamano_numero_frente, color_numero_frente,
              </p>
              <p style={{ fontSize: '10px', color: '#1e40af', marginBottom: '2px' }}>
                tamano_numero_espalda, color_numero_espalda, tamano_nombre_espalda, color_nombre_espalda,
              </p>
              <p style={{ fontSize: '10px', color: '#1e40af' }}>
                tamano_numero_short, color_numero_short
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 24px',
              backgroundColor: '#6b7280',
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

        {/* Loading Overlay */}
        {isProcessing && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              zIndex: 10,
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              maxWidth: '400px',
              width: '90%',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  border: '4px solid #e5e7eb',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                }}>
                  Procesando Excel...
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  Por favor espera mientras procesamos los datos
                </p>
              </div>

              {processingProgress.total > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                      Progreso
                    </span>
                    <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>
                      {processingProgress.current} / {processingProgress.total}
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
                        width: `${(processingProgress.current / processingProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
