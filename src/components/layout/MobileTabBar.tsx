'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Settings, LucideIcon } from 'lucide-react'
import { TbDeviceAnalytics } from "react-icons/tb"
import { PiCashRegister } from 'react-icons/pi'
import type { IconType } from 'react-icons'
import { LuLayoutDashboard } from "react-icons/lu"
import localFont from 'next/font/local'

// Configurar la fuente personalizada
const momoTrust = localFont({
  src: [{
    path: '../../../public/fonts/Momo_Trust_Display/MomoTrustDisplay-Regular.ttf',
    weight: '400',
    style: 'normal',
  }],
  variable: '--font-momo-trust',
  display: 'swap',
})

type TabItem = {
  name: string
  path: string
  icon: LucideIcon | IconType
  colors: {
    gradient: string
    shadow: string
    wave: string
  }
}

const TAB_ITEMS: TabItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LuLayoutDashboard,
    colors: {
      gradient: 'from-blue-600 via-blue-500 to-blue-700',
      shadow: 'shadow-blue-500/50',
      wave: 'border-blue-300',
    },
  },
  {
    name: 'Analíticas',
    path: '/analytics',
    icon: TbDeviceAnalytics,
    colors: {
      gradient: 'from-purple-600 via-purple-500 to-purple-700',
      shadow: 'shadow-purple-500/50',
      wave: 'border-purple-300',
    },
  },
  {
    name: 'Terminal',
    path: '/pos',
    icon: PiCashRegister,
    colors: {
      gradient: 'from-green-600 via-green-500 to-green-700',
      shadow: 'shadow-green-500/50',
      wave: 'border-green-300',
    },
  },
  {
    name: 'Inventario',
    path: '/inventory',
    icon: ClipboardList,
    colors: {
      gradient: 'from-yellow-600 via-yellow-500 to-yellow-700',
      shadow: 'shadow-yellow-500/50',
      wave: 'border-yellow-300',
    },
  },
  {
    name: 'Ajustes',
    path: '/settings',
    icon: Settings,
    colors: {
      gradient: 'from-red-600 via-red-500 to-red-700',
      shadow: 'shadow-red-500/50',
      wave: 'border-red-300',
    },
  },
]

interface TabButtonProps {
  item: TabItem
  isActive: boolean
  isTransitioning: boolean
}

function TabButton({ item, isActive, isTransitioning }: TabButtonProps) {
  const Icon = item.icon

  const getGradientColors = (gradient: string) => {
    if (gradient.includes('blue')) return '#2563eb, #3b82f6, #1d4ed8'
    if (gradient.includes('purple')) return '#9333ea, #a855f7, #7e22ce'
    if (gradient.includes('green')) return '#16a34a, #22c55e, #15803d'
    if (gradient.includes('yellow')) return '#ca8a04, #eab308, #a16207'
    return '#dc2626, #ef4444, #b91c1c'
  }

  const getShadowColor = (gradient: string) => {
    if (gradient.includes('blue')) return 'rgba(59, 130, 246, 0.5)'
    if (gradient.includes('purple')) return 'rgba(168, 85, 247, 0.5)'
    if (gradient.includes('green')) return 'rgba(34, 197, 94, 0.5)'
    if (gradient.includes('yellow')) return 'rgba(234, 179, 8, 0.5)'
    return 'rgba(239, 68, 68, 0.5)'
  }

  const getBorderColor = (gradient: string) => {
    if (gradient.includes('blue')) return '#93c5fd'
    if (gradient.includes('purple')) return '#d8b4fe'
    if (gradient.includes('green')) return '#86efac'
    if (gradient.includes('yellow')) return '#fde047'
    return '#fca5a5'
  }

  const gradientColors = getGradientColors(item.colors.gradient)
  const shadowColor = getShadowColor(item.colors.gradient)
  const borderColor = getBorderColor(item.colors.gradient)

  return (
    <Link
      href={item.path}
      className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 xs:px-2 py-2 rounded-2xl min-w-[44px] min-h-[44px] ${
        isActive ? 'text-white' : 'text-gray-500 hover:text-blue-600'
      }`}
    >
      {isActive && (
        <>
          <div
            className="absolute inset-0 rounded-2xl shadow-lg"
            style={{
              background: `linear-gradient(to bottom right, ${gradientColors})`,
              boxShadow: `0 10px 15px -3px ${shadowColor}, 0 4px 6px -4px ${shadowColor}`
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full shadow-xl flex items-center justify-center border-white"
            style={{
              top: 'clamp(-1.25rem, -4vw, -1.5rem)',
              width: 'clamp(2.5rem, 8vw, 2.75rem)',
              height: 'clamp(2.5rem, 8vw, 2.75rem)',
              borderWidth: 'clamp(3px, 1vw, 4px)',
              background: `linear-gradient(to bottom right, ${gradientColors})`,
              boxShadow: `0 20px 25px -5px ${shadowColor}, 0 8px 10px -6px ${shadowColor}`
            }}
          >
            <Icon className="text-white" strokeWidth={2.5} style={{ width: 'clamp(1rem, 3.5vw, 1.25rem)', height: 'clamp(1rem, 3.5vw, 1.25rem)' }} />
          </div>
          {isTransitioning && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
              style={{
                top: 'clamp(-1.25rem, -4vw, -1.5rem)',
                width: 'clamp(2.5rem, 8vw, 2.75rem)',
                height: 'clamp(2.5rem, 8vw, 2.75rem)',
                animation: 'ping 0.5s cubic-bezier(0, 0, 0.2, 1)',
                borderColor: borderColor
              }}
            />
          )}
        </>
      )}
      <div className="relative z-10 flex flex-col items-center gap-0.5 sm:gap-1">
        {!isActive && <Icon className="transition-all duration-500 scale-100 opacity-100" strokeWidth={2} style={{ width: 'clamp(1.25rem, 4vw, 1.5rem)', height: 'clamp(1.25rem, 4vw, 1.5rem)' }} />}
        <span
          className={`${momoTrust.className} font-semibold ${isActive ? 'mt-3 xs:mt-4 opacity-100' : 'opacity-80'} leading-tight`}
          style={{ fontSize: 'clamp(0.6rem, 2.5vw, 0.75rem)' }}
        >
          {item.name}
        </span>
      </div>
      {isActive && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-80" />
      )}
    </Link>
  )
}

export default function MobileTabBar() {
  const pathname = usePathname()
  const [previousPath, setPreviousPath] = useState(pathname)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (previousPath !== pathname) {
      setIsTransitioning(true)
      setPreviousPath(pathname)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [pathname, previousPath])

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
        <div className="flex items-center justify-around gap-0.5 xs:gap-1 px-1 xs:px-2 py-2.5 xs:py-3 pb-safe">
          {TAB_ITEMS.map((item) => (
            <TabButton
              key={item.path}
              item={item}
              isActive={pathname === item.path}
              isTransitioning={isTransitioning && pathname === item.path}
            />
          ))}
        </div>
      </div>

      <style jsx global>{`
        .pb-safe {
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        /* Custom xs breakpoint for very small devices (375px+) */
        @media (min-width: 375px) {
          .xs\\:px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .xs\\:py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
          .xs\\:gap-1 { gap: 0.25rem; }
          .xs\\:-top-6 { top: -1.5rem; }
          .xs\\:w-11 { width: 2.75rem; }
          .xs\\:h-11 { height: 2.75rem; }
          .xs\\:w-5 { width: 1.25rem; }
          .xs\\:h-5 { height: 1.25rem; }
          .xs\\:w-6 { width: 1.5rem; }
          .xs\\:h-6 { height: 1.5rem; }
          .xs\\:text-xs { font-size: 0.75rem; }
          .xs\\:mt-4 { margin-top: 1rem; }
          .xs\\:border-4 { border-width: 4px; }
        }
      `}</style>
    </>
  )
}