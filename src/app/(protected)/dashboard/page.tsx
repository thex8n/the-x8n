'use client'

import SignOutButton from '@/components/auth/SignOutButton'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <SignOutButton />
      </div>
      <div className="bg-white p-6  rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-600">Bienvenido a tu dashboard protegido</p>
      </div>
    </div>
  ) 
}