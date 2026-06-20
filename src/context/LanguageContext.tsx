'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { LangCode, TranslationKey } from '@/lib/i18n'
import { t as translate } from '@/lib/i18n'

interface LanguageContextType {
  lang: LangCode
  setLang: (lang: LangCode) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ja',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('ja')

  useEffect(() => {
    const saved = localStorage.getItem('foodeye_lang') as LangCode | null
    if (saved) setLangState(saved)
  }, [])

  const setLang = useCallback((l: LangCode) => {
    setLangState(l)
    localStorage.setItem('foodeye_lang', l)
  }, [])

  const t = useCallback((key: TranslationKey) => translate(lang, key), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
