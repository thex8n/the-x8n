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
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
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
          {/* Opción Manual - Deshabilitada temporalmente */}
          <button
            disabled
            className="w-full bg-gray-100 border-2 border-gray-200 rounded-xl p-6 text-left opacity-50 cursor-not-allowed relative"
          >
            <div className="flex items-start gap-4">
              <div className="bg-gray-400 text-white p-3 rounded-xl">
                <NotebookPen className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Registro Manual
                </h3>
                <p className="text-sm text-gray-600">
                  Próximamente disponible
                </p>
              </div>
            </div>
            <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              Pronto
            </span>
          </button>

          {/* Opción Escáner */}
          <button
            onClick={() => onSelectMode('scanner')}
            className="w-full bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-300 rounded-xl p-6 transition-all text-left group"
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