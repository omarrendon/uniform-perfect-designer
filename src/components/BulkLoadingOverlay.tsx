import React from "react";
import { Upload, Loader2 } from "lucide-react";

interface BulkLoadingOverlayProps {
  isVisible: boolean;
  currentUniform: number;
  totalUniforms: number;
}

export const BulkLoadingOverlay: React.FC<BulkLoadingOverlayProps> = ({
  isVisible,
  currentUniform,
  totalUniforms,
}) => {
  if (!isVisible) return null;

  const progress = totalUniforms > 0 ? (currentUniform / totalUniforms) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Card Central */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px',
          maxWidth: '28rem',
          width: '100%',
          margin: '0 16px',
        }}
      >
        {/* Icono y Spinner */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            {/* Spinner rotatorio */}
            <Loader2
              style={{
                width: '64px',
                height: '64px',
                color: '#2563eb',
                animation: 'spin 1s linear infinite',
              }}
            />
            {/* Icono de upload en el centro */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Upload style={{ width: '32px', height: '32px', color: '#2563eb' }} />
            </div>
          </div>

          {/* Texto principal */}
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px',
          }}>
            Cargando Uniformes
          </h2>
          <p style={{
            color: '#6b7280',
            textAlign: 'center',
          }}>
            Por favor espera mientras creamos los uniformes...
          </p>
        </div>

        {/* Barra de progreso */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Uniforme {currentUniform} de {totalUniforms}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}>
              {Math.round(progress)}%
            </span>
          </div>

          {/* Barra de progreso visual */}
          <div style={{
            width: '100%',
            backgroundColor: '#e5e7eb',
            borderRadius: '9999px',
            height: '12px',
            overflow: 'hidden',
          }}>
            <div
              style={{
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                height: '100%',
                borderRadius: '9999px',
                transition: 'width 0.3s ease-out',
                width: `${progress}%`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Animación de brillo */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite',
              }} />
            </div>
          </div>
        </div>

        {/* Mensaje adicional */}
        <div style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
          <p>No cierres esta ventana ni refresques la página</p>
        </div>
      </div>

      {/* Animaciones CSS */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};
