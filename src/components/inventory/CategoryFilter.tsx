'use client'

import { Category } from '@/types/category'

interface CategoryFilterProps {
  categories: Category[]
  selectedCategoryId: string | null
  onChange: (categoryId: string | null) => void
}

export default function CategoryFilter({ categories, selectedCategoryId, onChange }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Categoría:</label>
      <select
        value={selectedCategoryId || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="">Todas las categorías</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.icon} {category.name}
          </option>
        ))}
      </select>
    </div>
  )
}
