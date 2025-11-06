'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

interface MobileSearchHeaderProps {
  onSearch: (query: string) => void
  searchQuery: string
}

export default function MobileSearchHeader({ onSearch, searchQuery }: MobileSearchHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleExpand = () => {
    setIsExpanded(true)
  }

  const handleClose = () => {
    setIsExpanded(false)
    onSearch('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value)
  }

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      {!isExpanded ? (
        // Estado colapsado - Solo botón de lupa
        <div className="flex items-center justify-end p-4">
          <button
            onClick={handleExpand}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Abrir búsqueda"
          >
            <Search className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      ) : (
        // Estado expandido - Input de búsqueda
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleChange}
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Cerrar búsqueda"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      )}
    </div>
  )
}