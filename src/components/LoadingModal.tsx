import React from "react";
import { FileDown, Loader2 } from "lucide-react";

interface LoadingModalProps {
  isOpen: boolean;
  currentPage?: number;
  totalPages?: number;
  message?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  currentPage,
  totalPages,
  message = "Procesando...",
}) => {
  if (!isOpen) return null;

  const progress = currentPage && totalPages
    ? Math.round((currentPage / totalPages) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 max-w-md">
        {/* Icono animado */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <FileDown className="w-10 h-10 text-blue-600" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          </div>
        </div>

        {/* Título */}
        <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
          Exportando PDF
        </h3>

        {/* Mensaje */}
        <p className="text-sm text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Barra de progreso */}
        {currentPage !== undefined && totalPages !== undefined && totalPages > 0 && (
          <div className="space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Información de progreso */}
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <span className="font-semibold text-blue-600">
                {progress}%
              </span>
            </div>
          </div>
        )}

        {/* Spinner alternativo cuando no hay páginas */}
        {(!currentPage || !totalPages) && (
          <div className="flex justify-center">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}

        {/* Mensaje de espera */}
        <p className="text-xs text-gray-500 text-center mt-6">
          Por favor, no cierres esta ventana
        </p>
      </div>
    </div>
  );
};
