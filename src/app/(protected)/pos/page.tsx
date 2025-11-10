'use client'

import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import POSModeSelectionModal from '@/components/pos/POSModeSelectionModal'
import POSBarcodeScannerModal from '@/components/pos/POSBarcodeScannerModal'
import { CartItem } from '@/types/cart'

export default function POSPage() {
  const [showModeSelection, setShowModeSelection] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  const handleModeSelect = (mode: 'manual' | 'scanner') => {
    setShowModeSelection(false)
    if (mode === 'scanner') {
      setShowScanner(true)
    }
    // Modo manual sin funcionalidad por ahora
  }

  return (
    <div className="p-8 pb-32 pt-20 md:pt-8 md:pb-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terminal POS</h1>
          <p className="text-gray-600">Sistema de punto de venta</p>
        </div>

        {/* Botón abrir scanner - Solo desktop */}
        <button
          onClick={() => setShowModeSelection(true)}
          className="hidden md:flex w-full bg-green-600 text-white font-semibold py-6 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all items-center justify-center gap-3"
        >
          <DollarSign className="w-8 h-8" />
          <span className="text-xl">Abrir Terminal de Ventas</span>
        </button>

        {/* Info */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Instrucciones:</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">1.</span>
              <span>Presiona "Abrir Terminal de Ventas"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">2.</span>
              <span>Elige entre registro manual o escaneo rápido</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <span>Agrega productos al carrito</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">4.</span>
              <span>Presiona "Finalizar Venta" cuando termines</span>
            </li>
          </ul>
        </div>

        {/* Estadísticas rápidas */}
        {cart.length > 0 && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-800 font-semibold text-center">
              {cart.length} producto{cart.length !== 1 ? 's' : ''} en carrito
            </p>
          </div>
        )}
      </div>

      {/* Botón flotante para abrir scanner - Solo móvil */}
      <button
        onClick={() => setShowModeSelection(true)}
        className="md:hidden fixed w-16 h-16 bg-black text-white rounded-2xl shadow-2xl transition-all flex items-center justify-center z-40 active:scale-95"
        style={{ 
          bottom: '6rem',
          right: '1.5rem'
        }}
        aria-label="Abrir Terminal de Ventas"
      >
        <DollarSign className="w-8 h-8" strokeWidth={2.5} />
      </button>

      {/* Modal de Selección de Modo */}
      {showModeSelection && (
        <POSModeSelectionModal
          onClose={() => setShowModeSelection(false)}
          onSelectMode={handleModeSelect}
        />
      )}

      {/* Scanner Modal con carrito integrado */}
      {showScanner && (
        <POSBarcodeScannerModal
          onClose={() => setShowScanner(false)}
          cart={cart}
          onUpdateCart={setCart}
        />
      )}
    </div>
  )
}