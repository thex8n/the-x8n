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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 pb-24 md:pb-4"
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
          {/* Opción Manual */}
          <button
            onClick={() => onSelectMode('manual')}
            className="w-full bg-white hover:bg-gray-50 border-2 border-red-500 hover:border-red-600 rounded-xl p-6 transition-all text-left group"
            style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)' }}
          >
            <div className="flex items-start gap-4">
              <div className="bg-red-500 text-white p-3 rounded-xl">
                <NotebookPen className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Registro Manual
                </h3>
                <p className="text-sm text-gray-600">
                  Registra una venta de forma manual mediante el formulario.
                </p>
              </div>
            </div>
          </button>

          {/* Opción Escáner */}
          <button
            onClick={() => onSelectMode('scanner')}
            className="w-full bg-white hover:bg-gray-50 border-2 border-green-500 hover:border-green-600 rounded-xl p-6 transition-all text-left group"
            style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.15)' }}
          >
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white p-3 rounded-xl">
                <ScanLine className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Escaneo Rápido
                </h3>
                <p className="text-sm text-gray-600">
                  Registra los productos para la venta de forma rápida mediante el escáner.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}