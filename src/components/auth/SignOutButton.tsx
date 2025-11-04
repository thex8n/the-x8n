'use client'

import { signOut } from '@/app/actions/auth'
import { useState } from 'react'

export default function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  )
}