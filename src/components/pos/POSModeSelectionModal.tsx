'use client'

import { X, NotebookPen, ScanLine } from 'lucide-react'

interface POSModeSelectionModalProps {
  onClose: () => void
  onSelectMode: (mode: 'manual' | 'scanner') => void
}

export default function POSModeSelectionModal({
  onClose,
  onSelectMode,
}: POSModeSelectionModalProps) {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Solo cerrar si se hace clic en el backdrop, no en el contenido del modal
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Título */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Selecciona una opción
          </h2>
          <p className="text-gray-500 mt-1">
            ¿Cómo deseas registrar los productos?
          </p>
        </div>

        {/* Opciones */}
        <div className="space-y-4">
          {/* Opción Manual */}
          <button
            onClick={() => onSelectMode('manual')}
            className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 hover:border-blue-300 rounded-xl p-6 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-blue-500 text-white p-3 rounded-xl group-hover:scale-110 transition-transform">
                <NotebookPen className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Registro Manual
                </h3>
                <p className="text-sm text-gray-600">
                  Introduce la información manualmente
                </p>
              </div>
            </div>
          </button>

          {/* Opción Escáner */}
          <button
            onClick={() => onSelectMode('scanner')}
            className="w-full bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-200 hover:border-green-300 rounded-xl p-6 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white p-3 rounded-xl group-hover:scale-110 transition-transform">
                <ScanLine className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Escaneo Rápido
                </h3>
                <p className="text-sm text-gray-600">
                  Registra automáticamente con el escáner
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}