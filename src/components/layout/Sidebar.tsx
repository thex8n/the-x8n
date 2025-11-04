'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, Package, CreditCard, Settings, Menu, Sun, Moon, LucideIcon, MoreVertical } from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'Terminal POS', icon: CreditCard },
  { href: '/analytics', label: 'Analíticas', icon: BarChart3 },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

const SIDEBAR_WIDTH = {
  expanded: 'w-60',
  collapsed: 'w-20',
} as const

interface NavLinkProps {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
}

function NavLink({ item, isActive, isCollapsed }: NavLinkProps) {
  const Icon = item.icon
  
  const baseClasses = 'flex items-center rounded-lg transition-colors duration-200'
  const sizeClasses = 'gap-6 py-3 px-4'
  const stateClasses = isActive ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
  const iconColor = isActive ? 'text-gray-900' : 'text-gray-700'
  const textClasses = isActive ? 'text-gray-900 font-medium' : 'text-gray-700'

  return (
    <Link
      href={item.href}
      className={`${baseClasses} ${sizeClasses} ${stateClasses}`}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon size={24} className={`${iconColor} shrink-0`} />
      <span className={`text-base ${textClasses} whitespace-nowrap transition-all duration-300 ${
        isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
      }`}>
        {item.label}
      </span>
    </Link>
  )
}

interface SidebarProps {
  userName?: string
  userInitials?: string
}

export default function Sidebar({ userName = 'Usuario', userInitials = 'U' }: SidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, toggle } = useSidebar()
  const [isDarkMode, setIsDarkMode] = useState(false)

  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded

  return (
    <aside className={`${sidebarWidth} bg-white min-h-screen flex flex-col border-r border-gray-200 transition-all duration-300 ease-in-out`}>
      <div className="h-16 flex items-center px-3 gap-4 overflow-hidden">
        <button
          onClick={toggle}
          className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <Menu size={24} className="text-gray-700" />
        </button>
        <h1 className={`text-2xl font-semibold text-gray-900 whitespace-nowrap transition-all duration-300 ${
          isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
        }`}>
          The X8N
        </h1>
      </div>

      <nav className="flex-1 py-3">
        <ul className="space-y-1.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="px-3">
              <NavLink item={item} isActive={pathname === item.href} isCollapsed={isCollapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-200 py-3 px-3 space-y-3">
        <div className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full h-full flex items-center justify-center"
              aria-label={isDarkMode ? 'Modo oscuro' : 'Modo claro'}
            >
              {isDarkMode ? (
                <Moon size={20} className="text-gray-700" />
              ) : (
                <Sun size={20} className="text-gray-700" />
              )}
            </button>
          </div>
          <div className={`flex-1 min-w-0 transition-all duration-300 ${
            isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
          }`}>
            <p className="text-sm font-medium text-gray-900 truncate whitespace-nowrap">
              {isDarkMode ? 'Modo oscuro' : 'Modo claro'}
            </p>
          </div>
        </div>

        <Link 
          href="/profile"
          className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors group overflow-hidden"
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-gray-700">{userInitials}</span>
          </div>
          <div className={`flex-1 min-w-0 transition-all duration-300 ${
            isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
          }`}>
            <p className="text-sm font-medium text-gray-900 truncate whitespace-nowrap">{userName}</p>
          </div>
          <div 
            className={`shrink-0 transition-all duration-300 ${
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}
          >
            <MoreVertical size={20} className="text-gray-500 transition-opacity duration-300" />
          </div>
        </Link>
      </div>
    </aside>
  )
}