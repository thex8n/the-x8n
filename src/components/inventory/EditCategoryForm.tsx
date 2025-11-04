'use client'

import { useState } from 'react'
import { updateCategory } from '@/app/actions/categories'
import { Category, CategoryFormData } from '@/types/category'

interface EditCategoryFormProps {
  category: Category
  onClose: () => void
  onSuccess: () => void
  categories?: Category[]
}

const EMOJI_OPTIONS = ['📦', '🛒', '👕', '💻', '🏠', '🍎', '💊', '🔧', '📱', '🎮', '🍔', '⚡', '🎨', '📚', '🏃']
const COLOR_PRESETS = ['#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6']

export default function EditCategoryForm({ category, onClose, onSuccess, categories = [] }: EditCategoryFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CategoryFormData>({
    name: category.name,
    description: category.description || '',
    parent_category_id: category.parent_category_id,
    color: category.color,
    icon: category.icon,
    active: category.active,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }

    setLoading(true)
    setError(null)

    const result = await updateCategory(category.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onSuccess()
      onClose()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const availableCategories = categories.filter(cat => cat.id !== category.id)

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
            <h2 className="text-2xl font-bold text-gray-900">Editar Categoría</h2>
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
            <div>
              <label htmlFor="name" className={labelClasses}>
                Nombre *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={inputClasses}
                placeholder="Ej: Electrónica"
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClasses}>
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className={inputClasses}
                placeholder="Descripción de la categoría..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>
                  Icono *
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                      className={`p-3 text-2xl border-2 rounded-lg transition-all ${
                        formData.icon === emoji
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClasses}>
                  Color *
                </label>
                <div className="space-y-2">
                  <input
                    type="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`h-8 rounded border-2 transition-all ${
                          formData.color === color
                            ? 'border-gray-900 scale-110'
                            : 'border-gray-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="parent_category_id" className={labelClasses}>
                Categoría Padre (opcional)
              </label>
              <select
                id="parent_category_id"
                name="parent_category_id"
                value={formData.parent_category_id || ''}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="">Sin categoría padre</option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
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
                Categoría Activa
              </label>
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
                {loading ? 'Actualizando...' : 'Actualizar Categoría'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
