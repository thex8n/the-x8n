'use client'

import { useState, useEffect, useCallback } from 'react'
import AddProductForm from '@/components/inventory/AddProductForm'
import AddCategoryForm from '@/components/inventory/AddCategoryForm'
import EditProductForm from '@/components/inventory/EditProductForm'
import ProductList from '@/components/inventory/ProductList'
import ProductStats from '@/components/inventory/ProductStats'
import SearchBar from '@/components/inventory/SearchBar'
import CreateMenuModal from '@/components/inventory/CreateMenuModal'
import CategoryFilter from '@/components/inventory/CategoryFilter'
import { getProducts } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { ProductWithCategory } from '@/types/product'
import { Category } from '@/types/category'

export default function InventoryPage() {
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null)
  const [allProducts, setAllProducts] = useState<ProductWithCategory[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const loadProducts = async () => {
    setLoading(true)
    const result = await getProducts()
    if ('data' in result && result.data) {
      setAllProducts(result.data)
      setFilteredProducts(result.data)
    }
    setLoading(false)
  }

  const loadCategories = async () => {
    const result = await getCategories()
    if ('data' in result && result.data) {
      setCategories(result.data)
    }
  }

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const handleSuccess = () => {
    loadProducts()
  }

  const handleCategorySuccess = () => {
    loadCategories()
    setShowAddCategoryForm(false)
  }

  const applyFilters = useCallback(() => {
    let filtered = allProducts

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase()
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(lowerQuery) ||
        product.code.toLowerCase().includes(lowerQuery)
      )
    }

    if (selectedCategoryId) {
      filtered = filtered.filter(product => product.category_id === selectedCategoryId)
    }

    setFilteredProducts(filtered)
  }, [allProducts, searchQuery, selectedCategoryId])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleCategoryChange = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId)
  }, [])

  return (
    <div className="p-8 pb-32">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Inventario</h1>

      <div className="border-t border-gray-300 mb-6"></div>

      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <SearchBar onSearch={handleSearch} isLoading={loading} />
          <CategoryFilter
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onChange={handleCategoryChange}
          />
        </div>

        <button
          onClick={() => setShowCreateMenu(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear
        </button>
      </div>

      <ProductStats products={filteredProducts} />

      <ProductList
        products={filteredProducts}
        onProductDeleted={loadProducts}
        onProductEdit={setEditingProduct}
      />

      {showCreateMenu && (
        <CreateMenuModal
          onClose={() => setShowCreateMenu(false)}
          onSelectProduct={() => {
            setShowCreateMenu(false)
            setShowAddProductForm(true)
          }}
          onSelectCategory={() => {
            setShowCreateMenu(false)
            setShowAddCategoryForm(true)
          }}
        />
      )}

      {showAddProductForm && (
        <AddProductForm
          onClose={() => setShowAddProductForm(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showAddCategoryForm && (
        <AddCategoryForm
          onClose={() => setShowAddCategoryForm(false)}
          onSuccess={handleCategorySuccess}
          categories={categories}
        />
      )}

      {editingProduct && (
        <EditProductForm
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}