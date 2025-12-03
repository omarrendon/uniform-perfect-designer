import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const handlePrevious = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    onPageChange(page);
  };

  // Generar números de página para mostrar
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Mostrar todas las páginas si son pocas
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Mostrar páginas con ellipsis
      if (currentPage <= 2) {
        // Inicio
        for (let i = 0; i < 3; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages - 1);
      } else if (currentPage >= totalPages - 3) {
        // Final
        pages.push(0);
        pages.push("...");
        for (let i = totalPages - 3; i < totalPages; i++) pages.push(i);
      } else {
        // Medio
        pages.push(0);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages - 1);
      }
    }

    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px 20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
        borderRadius: '0 0 8px 8px',
      }}
    >
      {/* Botón Anterior */}
      <button
        onClick={handlePrevious}
        disabled={currentPage === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.2s',
          border: 'none',
          cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
          color: currentPage === 0 ? '#9ca3af' : '#374151',
          backgroundColor: currentPage === 0 ? 'transparent' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (currentPage !== 0) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <ChevronLeft style={{ width: '16px', height: '16px' }} />
        Anterior
      </button>

      {/* Números de página */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {getPageNumbers().map((page, index) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                style={{
                  padding: '0 8px',
                  color: '#9ca3af',
                  fontSize: '14px',
                }}
              >
                ...
              </span>
            );
          }

          const pageNumber = page as number;
          const isActive = pageNumber === currentPage;

          return (
            <button
              key={pageNumber}
              onClick={() => handlePageClick(pageNumber)}
              style={{
                minWidth: '36px',
                height: '36px',
                padding: '0 12px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'white' : '#374151',
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {pageNumber + 1}
            </button>
          );
        })}
      </div>

      {/* Botón Siguiente */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages - 1}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.2s',
          border: 'none',
          cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
          color: currentPage === totalPages - 1 ? '#9ca3af' : '#374151',
          backgroundColor: currentPage === totalPages - 1 ? 'transparent' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (currentPage !== totalPages - 1) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        Siguiente
        <ChevronRight style={{ width: '16px', height: '16px' }} />
      </button>

      {/* Información de página */}
      <div
        style={{
          marginLeft: '16px',
          fontSize: '14px',
          color: '#6b7280',
        }}
      >
        Página <span style={{ fontWeight: '500', color: '#374151' }}>{currentPage + 1}</span> de{" "}
        <span style={{ fontWeight: '500', color: '#374151' }}>{totalPages}</span>
      </div>
    </div>
  );
};
