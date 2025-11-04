import Sidebar from '@/components/layout/Sidebar'
import { getUser } from '@/app/actions/auth'
import { SidebarProvider } from '@/contexts/SidebarContext'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  const userName = user?.user_metadata?.full_name || user?.email || 'Usuario'
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <SidebarProvider>
      <div className="flex">
        <Sidebar userName={userName} userInitials={userInitials} />
        <main className="flex-1 bg-gray-50 min-h-screen">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}