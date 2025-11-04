'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  isLoading?: boolean
}

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 150)

    return () => clearTimeout(timer)
  }, [query, onSearch])

  const handleClear = () => {
    setQuery('')
  }

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o código..."
        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={isLoading}
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
