'use client'

import { CartItem } from '@/types/cart'
import { Minus, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'

interface CartListProps {
  items: CartItem[]
  onIncrement: (productId: string) => void
  onDecrement: (productId: string) => void
  onRemove: (productId: string) => void
}

export default function CartList({ items, onIncrement, onDecrement, onRemove }: CartListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">Carrito vacío</p>
        <p className="text-gray-400 text-sm mt-1">Escanea productos para agregar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const subtotal = (item.product.sale_price || 0) * item.quantity

        return (
          <div
            key={item.product.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              {/* Imagen del producto */}
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.product.image_url ? (
                  <Image
                    src={item.product.image_url}
                    alt={item.product.name}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>

              {/* Información del producto */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{item.product.name}</h3>
                <p className="text-sm text-gray-500">Código: {item.product.code}</p>
                <p className="text-sm font-medium text-green-600 mt-1">
                  ${item.product.sale_price?.toLocaleString() || 0}
                </p>
              </div>

              {/* Botón eliminar */}
              <button
                onClick={() => onRemove(item.product.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Controles de cantidad y subtotal */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              {/* Controles de cantidad */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDecrement(item.product.id)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={item.quantity <= 1}
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <span className="w-12 text-center font-semibold text-gray-900">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onIncrement(item.product.id)}
                  className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                  disabled={item.quantity >= item.product.stock_quantity}
                >
                  <Plus className="w-4 h-4 text-green-600" />
                </button>
              </div>

              {/* Subtotal */}
              <div className="text-right">
                <p className="text-xs text-gray-500">Subtotal</p>
                <p className="text-lg font-bold text-gray-900">
                  ${subtotal.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Advertencia de stock */}
            {item.quantity >= item.product.stock_quantity && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Stock máximo alcanzado ({item.product.stock_quantity} disponibles)
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
