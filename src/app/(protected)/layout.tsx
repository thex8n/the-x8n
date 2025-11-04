import Sidebar from '@/components/layout/Sidebar'
import MobileTabBar from '@/components/layout/MobileTabBar'
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
      <div className="flex min-h-screen">
        {/* Sidebar para desktop - se oculta en móvil */}
        <Sidebar userName={userName} userInitials={userInitials} />
        
        {/* Main content con padding bottom para el TabBar móvil */}
        <main className="flex-1 bg-gray-50 min-h-screen pb-24 md:pb-0">
          {children}
        </main>
      </div>
      
      {/* TabBar para móvil - FUERA del flex container */}
      <MobileTabBar />
    </SidebarProvider>
  )
}