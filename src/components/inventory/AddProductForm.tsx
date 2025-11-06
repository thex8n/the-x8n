'use client'

import { useState, useEffect } from 'react'
import { addProduct } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { ProductFormData } from '@/types/product'
import { Category } from '@/types/category'
import CategorySelector from './CategorySelector'
import AddCategoryForm from './AddCategoryForm'

interface AddProductFormProps {
  onClose: () => void
  onSuccess: () => void
  initialCode?: string | null
}

export default function AddProductForm({ onClose, onSuccess, initialCode }: AddProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryForm, setShowCategoryForm] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    code: initialCode || '',
    category_id: null,
    stock_quantity: 0,
    minimum_stock: 0,
    sale_price: undefined,
    cost_price: undefined,
    unit_of_measure: '',
    active: true,
  })

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (initialCode) {
      setFormData(prev => ({ ...prev, code: initialCode }))
    }
  }, [initialCode])

  const loadCategories = async () => {
    const result = await getCategories()
    if ('data' in result && result.data) {
      setCategories(result.data)
    }
  }

  const handleCategorySuccess = () => {
    loadCategories()
    setShowCategoryForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await addProduct(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onSuccess()
      onClose()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }))
  }

  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  const labelClasses = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Agregar Producto</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className={labelClasses}>
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Ej: Laptop Dell XPS 15"
                />
              </div>

              <div>
                <label htmlFor="code" className={labelClasses}>
                  Código *
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  required
                  value={formData.code}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Ej: PROD-001"
                />
              </div>

              <div>
                <label htmlFor="category_id" className={labelClasses}>
                  Categoría
                </label>
                <CategorySelector
                  value={formData.category_id}
                  onChange={(categoryId) => setFormData(prev => ({ ...prev, category_id: categoryId }))}
                  categories={categories}
                  onCreateNew={() => setShowCategoryForm(true)}
                />
              </div>

              <div>
                <label htmlFor="stock_quantity" className={labelClasses}>
                  Cantidad en Stock *
                </label>
                <input
                  type="number"
                  id="stock_quantity"
                  name="stock_quantity"
                  required
                  min="0"
                  value={formData.stock_quantity}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="minimum_stock" className={labelClasses}>
                  Stock Mínimo *
                </label>
                <input
                  type="number"
                  id="minimum_stock"
                  name="minimum_stock"
                  required
                  min="0"
                  value={formData.minimum_stock}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="sale_price" className={labelClasses}>
                  Precio de Venta
                </label>
                <input
                  type="number"
                  id="sale_price"
                  name="sale_price"
                  step="0.01"
                  min="0"
                  value={formData.sale_price || ''}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="cost_price" className={labelClasses}>
                  Precio de Costo
                </label>
                <input
                  type="number"
                  id="cost_price"
                  name="cost_price"
                  step="0.01"
                  min="0"
                  value={formData.cost_price || ''}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="unit_of_measure" className={labelClasses}>
                  Unidad de Medida
                </label>
                <input
                  type="text"
                  id="unit_of_measure"
                  name="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Ej: Unidad, Kg, Litro"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
                  Producto Activo
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Guardar Producto'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCategoryForm && (
        <AddCategoryForm
          onClose={() => setShowCategoryForm(false)}
          onSuccess={handleCategorySuccess}
          categories={categories}
        />
      )}
    </div>
  )
}
