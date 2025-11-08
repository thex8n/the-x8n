'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import AddProductForm from '@/components/inventory/AddProductForm'
import AddCategoryForm from '@/components/inventory/AddCategoryForm'
import EditProductForm from '@/components/inventory/EditProductForm'
import ProductList from '@/components/inventory/ProductList'
import MobileProductList from '@/components/inventory/MobileProductList'
import ProductStats from '@/components/inventory/ProductStats'
import SearchBar from '@/components/inventory/SearchBar'
import CreateMenuModal from '@/components/inventory/CreateMenuModal'
import CategoryFilter from '@/components/inventory/CategoryFilter'
import MobileSearchHeader from '@/components/inventory/MobileSearchHeader'
import BarcodeScannerModal from '@/components/inventory/BarcodeScannerModal'
import { getProducts } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { ProductWithCategory } from '@/types/product'
import { Category } from '@/types/category'

export default function InventoryPage() {
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null)
  const [allProducts, setAllProducts] = useState<ProductWithCategory[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

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
      const sortedCategories = result.data.sort((a, b) => {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      })
      setCategories(sortedCategories)
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

  const handleProductNotFound = (barcode: string) => {
    setScannedBarcode(barcode)
    setShowBarcodeScanner(false)
    setShowAddProductForm(true)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      return
    }

    const newCategories = [...categories]
    const draggedCategory = newCategories[draggedIndex]
    newCategories.splice(draggedIndex, 1)
    newCategories.splice(dropIndex, 0, draggedCategory)
    
    setCategories(newCategories)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <>
      <MobileSearchHeader
        onSearch={handleSearch}
        searchQuery={searchQuery}
      />

      <div className="p-8 pb-32">
        <div className="hidden md:block mb-6 -mt-4">
          <div className="flex items-center justify-between mb-6 relative">
            <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
            <div className="absolute left-1/2 transform -translate-x-1/2 w-full max-w-2xl">
              <SearchBar onSearch={handleSearch} isLoading={loading} />
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

          <div className="border-t border-gray-300 mb-6"></div>
        </div>

        <div className="hidden md:block">
          <ProductStats products={filteredProducts} />
        </div>

        <div className="hidden md:flex mb-6 items-center gap-3 flex-wrap">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategoryId === null
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          
          {categories.map((category, index) => (
            <button
              key={category.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelectedCategoryId(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-move flex items-center gap-2 ${
                selectedCategoryId === category.id
                  ? 'text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2'
              } ${draggedIndex === index ? 'opacity-50' : ''}`}
              style={
                selectedCategoryId === category.id
                  ? { backgroundColor: category.color, borderColor: category.color }
                  : { borderColor: category.color }
              }
            >
              <span className="cursor-grab active:cursor-grabbing">⋮⋮</span>
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}

          <button
            onClick={() => setShowAddCategoryForm(true)}
            className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center"
            aria-label="Crear nueva categoría"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="hidden md:block">
          <ProductList
            products={filteredProducts}
            onProductDeleted={loadProducts}
            onProductEdit={setEditingProduct}
          />
        </div>

        <div className="md:hidden">
          <MobileProductList
            products={filteredProducts}
            onProductDeleted={loadProducts}
            onProductEdit={setEditingProduct}
          />
        </div>

        <button
          onClick={() => setShowBarcodeScanner(true)}
          className="md:hidden fixed w-16 h-16 bg-black text-white rounded-2xl shadow-2xl transition-all flex items-center justify-center z-40 active:scale-95"
          style={{ 
            bottom: '6rem',
            right: '1.5rem'
          }}
          aria-label="Escanear código"
        >
          <Plus className="w-10 h-10" strokeWidth={3} />
        </button>

        {showBarcodeScanner && (
          <BarcodeScannerModal
            onClose={() => setShowBarcodeScanner(false)}
            onProductNotFound={handleProductNotFound}
            onStockUpdated={loadProducts}
          />
        )}

        {showCreateMenu && (
          <CreateMenuModal
            onClose={() => setShowCreateMenu(false)}
            onSelectScanner={() => {
              setShowCreateMenu(false)
              setShowBarcodeScanner(true)
            }}
            onSelectProduct={() => {
              setShowCreateMenu(false)
              setScannedBarcode(null)
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
            onClose={() => {
              setShowAddProductForm(false)
              setScannedBarcode(null)
            }}
            onSuccess={handleSuccess}
            initialCode={null}
            initialBarcode={scannedBarcode}
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
    </>
  )
}