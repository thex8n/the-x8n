'use client'

import { useState, useEffect } from 'react'
import { updateProduct } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { deleteProductImage } from '@/app/actions/upload'
import { Product, ProductFormData } from '@/types/product'
import { Category } from '@/types/category'
import CategorySelector from './CategorySelector'
import AddCategoryForm from './AddCategoryForm'
import ImageUpload from '@/components/ui/ImageUpload'

interface EditProductFormProps {
  product: Product
  onClose: () => void
  onSuccess: () => void
}

export default function EditProductForm({ product, onClose, onSuccess }: EditProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(product.image_url)
  const [oldImageToDelete, setOldImageToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState<ProductFormData>({
    name: product.name,
    code: product.code,
    barcode: product.barcode || '',
    category_id: product.category_id,
    stock_quantity: product.stock_quantity,
    minimum_stock: product.minimum_stock,
    sale_price: product.sale_price || undefined,
    cost_price: product.cost_price || undefined,
    unit_of_measure: product.unit_of_measure || '',
    image_url: product.image_url,
    active: product.active,
  })

  useEffect(() => {
    loadCategories()
  }, [])

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

  const handleOldImageDelete = (oldUrl: string) => {
    console.log('📌 Marcando imagen para eliminar al confirmar:', oldUrl)
    setOldImageToDelete(oldUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validación manual
    if (!formData.name.trim()) {
      setError('El nombre del producto es requerido')
      return
    }

    setLoading(true)
    setError(null)

    // Eliminar imagen anterior si fue marcada para eliminación
    if (oldImageToDelete) {
      console.log('🗑️ Eliminando imagen anterior de R2 al confirmar guardado...')
      try {
        const deleteResult = await deleteProductImage(oldImageToDelete)
        if (deleteResult.success) {
          console.log('✅ Imagen anterior eliminada de R2')
        } else {
          console.warn('⚠️ No se pudo eliminar imagen anterior:', deleteResult.error)
        }
      } catch (deleteError) {
        console.error('❌ Error eliminando imagen anterior:', deleteError)
      }
    }

    const result = await updateProduct(product.id, {
      ...formData,
      image_url: imageUrl
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onSuccess()
      onClose()
    }
  }

  const handleCancel = async () => {
    // Si hay una imagen nueva que no se guardó, eliminarla
    if (imageUrl && imageUrl !== product.image_url) {
      console.log('🗑️ Cancelando: eliminando imagen temporal de R2...')
      try {
        await deleteProductImage(imageUrl)
        console.log('✅ Imagen temporal eliminada')
      } catch (error) {
        console.error('❌ Error eliminando imagen temporal:', error)
      }
    }
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }))
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center overflow-y-auto"
      style={{ zIndex: 70 }}
      onClick={handleCancel}
    >
      <div
        className="bg-white w-full min-h-full md:min-h-0 md:my-8 md:rounded-lg md:shadow-xl md:max-w-3xl md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pb-32 md:p-6 md:pb-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 md:mb-6 bg-gray-100 md:bg-transparent px-4 md:px-0 py-5 md:py-0">
            <h2 className="text-3xl md:text-2xl font-bold text-gray-900">Editar Producto</h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 p-2"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 mx-4 md:mx-0 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 px-4 md:px-0">
            {/* Stock Actual y Stock Mínimo - Tarjetas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-yellow-400">
                <input
                  type="number"
                  id="stock_quantity"
                  name="stock_quantity"
                  min="0"
                  value={formData.stock_quantity === 0 ? '' : formData.stock_quantity}
                  onChange={handleChange}
                  placeholder="0"
                  className="text-3xl font-bold text-gray-900 bg-transparent border-none p-0 w-full focus:ring-0 focus:outline-none placeholder:text-gray-400"
                />
                <label htmlFor="stock_quantity" className="text-sm text-gray-500 mt-1 block">
                  Stock Actual
                </label>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border-2 border-red-400">
                <input
                  type="number"
                  id="minimum_stock"
                  name="minimum_stock"
                  min="0"
                  value={formData.minimum_stock === 0 ? '' : formData.minimum_stock}
                  onChange={handleChange}
                  placeholder="0"
                  className="text-3xl font-bold text-gray-900 bg-transparent border-none p-0 w-full focus:ring-0 focus:outline-none placeholder:text-gray-400"
                />
                <label htmlFor="minimum_stock" className="text-sm text-gray-500 mt-1 block">
                  Stock Mínimo
                </label>
              </div>
            </div>

            {/* Nombre del Producto */}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-gray-500 mb-2 uppercase">
                Nombre del Producto *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-0 py-3 border-0 border-b-2 ${formData.name ? 'border-green-500' : 'border-gray-200'} focus:border-green-500 focus:ring-0 focus:outline-none text-lg font-medium text-gray-900 bg-transparent transition-colors`}
                placeholder="Ej: Laptop Dell XPS 15"
              />
            </div>

            {/* Código Único y Código de Barra */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="code" className="block text-xs font-medium text-gray-500 mb-2 uppercase">
                  Código Único *
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className={`w-full px-0 py-3 border-0 border-b-2 ${formData.code ? 'border-green-500' : 'border-gray-200'} focus:border-green-500 focus:ring-0 focus:outline-none text-lg font-medium text-gray-900 bg-transparent transition-colors`}
                  placeholder="Ej: PROD-001"
                />
              </div>

              <div>
                <label htmlFor="barcode" className="block text-xs font-medium text-gray-500 mb-2 uppercase">
                  Código de Barra
                </label>
                <input
                  type="text"
                  id="barcode"
                  name="barcode"
                  value={formData.barcode || ''}
                  onChange={handleChange}
                  className={`w-full px-0 py-3 border-0 border-b-2 ${formData.barcode ? 'border-green-500' : 'border-gray-200'} focus:border-green-500 focus:ring-0 focus:outline-none text-lg font-medium text-gray-900 bg-transparent transition-colors`}
                  placeholder="Escanear o ingresar código"
                />
              </div>
            </div>

            {/* Precio Venta y Precio Costo - Tarjetas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-green-400">
                <input
                  type="number"
                  id="sale_price"
                  name="sale_price"
                  step="0.01"
                  min="0"
                  value={formData.sale_price || ''}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="text-3xl font-bold text-gray-900 bg-transparent border-none p-0 w-full focus:ring-0 focus:outline-none"
                />
                <label htmlFor="sale_price" className="text-sm text-gray-500 mt-1 block">
                  Precio Venta
                </label>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border-2 border-blue-400">
                <input
                  type="number"
                  id="cost_price"
                  name="cost_price"
                  step="0.01"
                  min="0"
                  value={formData.cost_price || ''}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="text-3xl font-bold text-gray-900 bg-transparent border-none p-0 w-full focus:ring-0 focus:outline-none"
                />
                <label htmlFor="cost_price" className="text-sm text-gray-500 mt-1 block">
                  Precio Costo
                </label>
              </div>
            </div>

            {/* Categoría y Unidad de Medida */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-xs font-medium text-gray-500 mb-2 uppercase">
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
                <label htmlFor="unit_of_measure" className="block text-xs font-medium text-gray-500 mb-2 uppercase">
                  Unidad de Medida
                </label>
                <input
                  type="text"
                  id="unit_of_measure"
                  name="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={handleChange}
                  className={`w-full px-0 py-3 border-0 border-b-2 ${formData.unit_of_measure ? 'border-green-500' : 'border-gray-200'} focus:border-green-500 focus:ring-0 focus:outline-none text-lg font-medium text-gray-900 bg-transparent transition-colors`}
                  placeholder="Ej: Unidad, Kg, Litro"
                />
              </div>
            </div>

            {/* Imagen del Producto */}
            <div>
              <ImageUpload
                currentImageUrl={imageUrl}
                onImageChange={setImageUrl}
                onOldImageDelete={handleOldImageDelete}
              />
            </div>

            {/* Producto Activo */}
            <div className="flex items-center pt-2">
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

            {/* Botones */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t sticky bottom-0 bg-white pb-4 px-4 -mx-4 md:px-0 md:mx-0">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 text-base bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Actualizando...' : 'Actualizar Producto'}
              </button>
            </div>
          </form>
        </div>

        {showCategoryForm && (
          <AddCategoryForm
            onClose={() => setShowCategoryForm(false)}
            onSuccess={handleCategorySuccess}
            categories={categories}
          />
        )}
      </div>
    </div>
  )
}