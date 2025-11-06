'use client'

import { useState } from 'react'
import { ProductWithCategory } from '@/types/product'
import { deleteProduct } from '@/app/actions/products'
import { ImagePlus } from 'lucide-react'

interface MobileProductListProps {
  products: ProductWithCategory[]
  onProductDeleted: () => void
  onProductEdit: (product: ProductWithCategory) => void
}

export default function MobileProductList({ products, onProductDeleted, onProductEdit }: MobileProductListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleDelete = async (productId: string) => {
    setDeletingId(productId)
    const result = await deleteProduct(productId)

    if (result.success) {
      onProductDeleted()
      setConfirmDelete(null)
      setOpenMenuId(null)
    }
    setDeletingId(null)
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const toggleMenu = (productId: string) => {
    setOpenMenuId(openMenuId === productId ? null : productId)
  }

  if (products.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay productos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza agregando tu primer producto al inventario.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-4">
      {products.map((product) => {
        const isLowStock = product.stock_quantity <= product.minimum_stock

        return (
          <div
            key={product.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {confirmDelete === product.id ? (
              <div className="p-4 flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-gray-700 text-center">¿Eliminar este producto?</p>
                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg disabled:opacity-50"
                  >
                    {deletingId === product.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex p-3 gap-3 pb-1">
                  {/* Imagen del producto */}
                  <div className="shrink-0">
                    <div className="w-20 h-20 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Información del producto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 leading-tight mb-0.5 truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-600 mb-1">
                          {product.code}
                        </p>
                        {product.category && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200">
                            <span className="text-xs">{product.category.icon}</span>
                            <span className="text-xs font-medium text-gray-700">{product.category.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Menú de opciones */}
                      <div className="relative">
                        <button
                          onClick={() => toggleMenu(product.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="Opciones"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>

                        {openMenuId === product.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={() => {
                                  // TODO: Implementar vista de detalles
                                  setOpenMenuId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Detalles
                              </button>
                              <button
                                onClick={() => {
                                  onProductEdit(product)
                                  setOpenMenuId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmDelete(product.id)
                                  setOpenMenuId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Precio alineado a la derecha */}
                    <div className="flex justify-end">
                      <div className="inline-block">
                        <p className="text-base font-bold text-gray-900 relative">
                          {formatPrice(product.sale_price)}
                          <span className="absolute bottom-1 left-0 right-0 h-0.5 bg-green-400"></span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer con Stock y espacio para código de barras */}
                <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
                  <div className="flex items-start justify-between">
                    {/* Stock */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Stock:</p>
                      <div className="flex items-center gap-1.5">
                        <p className={`text-2xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock_quantity}
                        </p>
                        {isLowStock && (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                            BAJO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Espacio reservado para código de barras */}
                    <div className="flex-1 flex items-center justify-end">
                      <div className="bg-white border border-gray-300 rounded px-3 py-1.5 h-12 flex items-center justify-center min-w-[150px]">
                        <p className="text-xs text-gray-400 text-center">Código de barras</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}