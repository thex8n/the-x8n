'use client'

import { useState, useEffect, useRef } from 'react'
import { Category } from '@/types/category'

interface CategorySelectorProps {
  value: string | null | undefined
  onChange: (categoryId: string | null) => void
  categories: Category[]
  onCreateNew?: () => void
  disabled?: boolean
}

export default function CategorySelector({ value, onChange, categories, onCreateNew, disabled = false }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedCategory = categories.find(cat => cat.id === value)

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2">
          {selectedCategory ? (
            <>
              <span className="text-lg">{selectedCategory.icon}</span>
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedCategory.color }}
              />
              <span className="text-sm text-gray-900">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Sin categoría</span>
          )}
        </span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoría..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-48">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <span className="text-gray-500">Sin categoría</span>
            </button>

            {filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleSelect(category.id)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                  value === category.id ? 'bg-blue-50' : ''
                }`}
              >
                <span className="text-lg">{category.icon}</span>
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-gray-900">{category.name}</span>
              </button>
            ))}

            {filteredCategories.length === 0 && searchQuery && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No se encontraron categorías
              </div>
            )}
          </div>

          {onCreateNew && (
            <div className="p-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onCreateNew()
                  setIsOpen(false)
                  setSearchQuery('')
                }}
                className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva categoría
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
