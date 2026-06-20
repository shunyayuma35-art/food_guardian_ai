'use client'

import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/context/LanguageContext'
import { LANGUAGES } from '@/lib/i18n'

export default function FloatingLanguageButton() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} className="fixed bottom-[72px] right-3 z-[100] no-print">
      {/* 言語リスト（上に展開） */}
      {open && (
        <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-48 mb-1">
          <div className="px-3 py-2 border-b border-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language / 言語</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
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
                <span className="flex-1">{l.name}</span>
                {l.code === lang && <span className="text-orange-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* フローティングボタン本体 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 flex flex-col items-center justify-center gap-0 hover:shadow-xl hover:border-orange-200 transition-all active:scale-95"
        aria-label="言語を切替"
      >
        <span className="text-xl leading-none">{current.flag}</span>
        <span className="text-[8px] text-gray-400 font-semibold leading-none mt-0.5">LANG</span>
      </button>
    </div>
  )
}
