'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const NAV_ITEMS = [
  { href: '/', icon: '🏠', label: 'ホーム' },
  { href: '/record', icon: '📷', label: '異物登録' },
  { href: '/inspection', icon: '🧲', label: '検査記録' },
  { href: '/list', icon: '📋', label: '一覧' },
  { href: '/qr', icon: '📲', label: 'QR共有' },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()

  async function handleLock() {
    await logout()
    router.replace('/login')
  }

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

        {/* 画面ロックボタン */}
        <button
          onClick={handleLock}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-400 hover:text-red-500 transition-colors active:scale-95"
        >
          <span className="text-xl leading-none">🔒</span>
          <span className="text-[9px] font-semibold">ロック</span>
        </button>
      </div>
    </nav>
  )
}
