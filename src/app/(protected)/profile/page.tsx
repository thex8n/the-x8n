import { getUser } from '@/app/actions/auth'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function ProfilePage() {
  const user = await getUser()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Perfil</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Nombre</p>
          <p className="text-gray-900">{user?.user_metadata?.full_name || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Email</p>
          <p className="text-gray-900">{user?.email}</p>
        </div>
        <div className="pt-4 border-t">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}