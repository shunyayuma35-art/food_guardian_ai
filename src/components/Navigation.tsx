'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/context/LanguageContext'

export default function Navigation() {
  const pathname = usePathname()
  const { t } = useLang()

  const NAV_ITEMS = [
    { href: '/',           icon: '🏠', label: t('nav.home') },
    { href: '/record',     icon: '📷', label: t('nav.record') },
    { href: '/ai-chat',    icon: '🔬', label: t('nav.ai') },
    { href: '/list',       icon: '📋', label: t('nav.list') },
    { href: '/inspection', icon: '🧲', label: t('nav.inspection') },
    { href: '/qr',         icon: '📱', label: t('nav.qr') },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-orange-100 shadow-[0_-4px_20px_rgba(251,146,60,0.10)] no-print">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                active ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[9px] font-semibold ${active ? 'text-orange-500' : ''}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-orange-400 rounded-b-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
