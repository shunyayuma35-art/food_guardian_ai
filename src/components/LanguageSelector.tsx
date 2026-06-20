'use client'

import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/context/LanguageContext'
import { LANGUAGES } from '@/lib/i18n'

export default function LanguageSelector() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 border border-gray-200 shadow-sm text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:border-orange-200 transition-all"
        aria-label="言語を選択"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <span className="text-gray-400 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[160px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors ${
                l.code === lang
                  ? 'bg-orange-50 text-orange-600 font-bold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.name}</span>
              {l.code === lang && <span className="ml-auto text-orange-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
