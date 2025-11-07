'use client'

import { useState } from 'react'
import { X, Search, Plus, Loader2 } from 'lucide-react'
import { CartItem } from '@/types/cart'
import { findProductByBarcode } from '@/actions/productActions'

interface POSManualEntryModalProps {
  onClose: () => void
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
}

export default function POSManualEntryModal({
  onClose,
  cart,
  onUpdateCart,
}: POSManualEntryModalProps) {
  const [barcode, setBarcode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAddProduct = async () => {
    if (!barcode.trim()) {
      setError('Ingresa un código de barras')
      return
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty < 1) {
      setError('Cantidad inválida')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await findProductByBarcode(barcode.trim())

      if (!result.success || !result.product) {
        setError('Producto no encontrado')
        setIsLoading(false)
        return
      }

      const product = result.product

      // Verificar stock
      if (product.stock_quantity < qty) {
        setError(`Stock insuficiente. Disponible: ${product.stock_quantity}`)
        setIsLoading(false)
        return
      }

      // Agregar al carrito
      const existingItemIndex = cart.findIndex((item) => item.product.barcode === barcode.trim())

      let newCart: CartItem[]
      if (existingItemIndex >= 0) {
        // Ya existe - actualizar cantidad
        newCart = [...cart]
        const newQuantity = newCart[existingItemIndex].quantity + qty
        
        if (newQuantity > product.stock_quantity) {
          setError(`Stock insuficiente. Disponible: ${product.stock_quantity}`)
          setIsLoading(false)
          return
        }

        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: newQuantity,
        }
      } else {
        // Nuevo producto
        const newItem: CartItem = {
          product: product,
          quantity: qty,
        }
        newCart = [...cart, newItem]
      }

      onUpdateCart(newCart)

      // Limpiar formulario
      setBarcode('')
      setQuantity('1')
      setError('')
      
      // Mostrar feedback visual
      const successMsg = document.createElement('div')
      successMsg.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[60]'
      successMsg.textContent = '✓ Producto agregado'
      document.body.appendChild(successMsg)
      setTimeout(() => successMsg.remove(), 2000)

    } catch (err) {
      setError('Error al buscar producto')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddProduct()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Registro Manual</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          {/* Campo código de barras */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código de Barras
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escanea o escribe el código"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Campo cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Botón agregar */}
          <button
            onClick={handleAddProduct}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Agregar al Carrito</span>
              </>
            )}
          </button>
        </div>

        {/* Info del carrito */}
        {cart.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              {cart.length} producto{cart.length !== 1 ? 's' : ''} en el carrito
            </p>
          </div>
        )}
      </div>
    </div>
  )
}