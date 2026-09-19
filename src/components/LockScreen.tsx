'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import FoodEyeLogo from './FoodEyeLogo'
import LanguageSelector from './LanguageSelector'

const LOCALE_MAP: Record<string, string> = {
  ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN',
  id: 'id-ID', ne: 'ne-NP', km: 'km-KH', my: 'my-MM', th: 'th-TH',
}

export default function LockScreen() {
  const pathname = usePathname()
  const { locked, unlock } = useAuth()
  const { lang, t } = useLang()
  const [now, setNow] = useState<Date | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const triggeredRef = useRef(false)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!locked || pathname === '/demo-login') return null

  const locale = LOCALE_MAP[lang] ?? 'ja-JP'
  const timeStr = now?.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '--:--'
  const dateStr = now?.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) ?? ''

  function handleUnlock() {
    if (triggeredRef.current) return
    triggeredRef.current = true
    setUnlocking(true)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col overflow-hidden select-none cursor-pointer transition-opacity duration-300 ${
        unlocking ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ background: 'linear-gradient(160deg, #fff7e0 0%, #ffeec2 35%, #ffe3cf 70%, #fff3e8 100%)' }}
      onClick={handleUnlock}
      onTouchEnd={(e) => { e.preventDefault(); handleUnlock() }}
      onTransitionEnd={() => { if (triggeredRef.current) unlock() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleUnlock() }}
      role="button"
      tabIndex={0}
      aria-label={t('lock.tap')}
    >
      {/* ウォーターマーク背景パターン */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cg%3E%3Ccircle cx='65' cy='65' r='38' fill='white'/%3E%3Ccircle cx='56' cy='62' r='5' fill='%231e3a8a'/%3E%3Ccircle cx='74' cy='62' r='5' fill='%231e3a8a'/%3E%3Cpath d='M55 76 Q65 83 75 76' fill='none' stroke='%231e3a8a' stroke-width='3' stroke-linecap='round'/%3E%3Cline x1='100' y1='100' x2='114' y2='114' stroke='%232563eb' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='89' cy='88' r='19' fill='none' stroke='%232563eb' stroke-width='4'/%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: '140px 140px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* 言語切り替え（右上） */}
      <div
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <LanguageSelector />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-between py-10 sm:py-14 px-6 max-w-md sm:max-w-lg mx-auto w-full">
        {/* 時刻・日付 */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-gray-700 font-extrabold tracking-tight leading-none text-6xl sm:text-7xl tabular-nums">
            {timeStr}
          </p>
          <p className="text-gray-500 font-semibold mt-3 text-base sm:text-lg">{dateStr}</p>
        </div>

        {/* ロゴ＋キャラクター */}
        <div className="flex flex-col items-center">
          <h1 className="text-white text-4xl sm:text-5xl font-extrabold tracking-tight drop-shadow-[0_2px_8px_rgba(194,138,53,0.45)]">
            FoodEye
          </h1>
          <div className="mt-3 w-36 h-36 sm:w-48 sm:h-48">
            <FoodEyeLogo size={160} className="w-full h-full drop-shadow-xl" />
          </div>
        </div>

        {/* タップ解除エリア */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-600 font-bold text-sm sm:text-base text-center">{t('lock.tap')}</p>
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            <span className="lock-ripple absolute inset-0 rounded-full bg-orange-300/40" />
            <span className="lock-ripple absolute inset-0 rounded-full bg-orange-300/40" style={{ animationDelay: '0.7s' }} />
            <span className="lock-ripple absolute inset-0 rounded-full bg-orange-300/40" style={{ animationDelay: '1.4s' }} />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-lg shadow-orange-200/70 border-2 border-orange-200 flex items-center justify-center">
              <FingerprintSearchIcon />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FingerprintSearchIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* 指紋（同心円弧） */}
      <path d="M24 12c-5 0-9 4-9 9v3" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M19 14c-3 1.8-5 5-5 8.5v4" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M24 17c-2.8 0-5 2.2-5 5v4.5" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M14 16c-1.8 2.4-3 5.5-3 9" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* 虫眼鏡 */}
      <circle cx="29" cy="29" r="8.5" fill="rgba(219,234,254,0.6)" stroke="#2563eb" strokeWidth="2.6" />
      <line x1="35" y1="35" x2="41" y2="41" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
