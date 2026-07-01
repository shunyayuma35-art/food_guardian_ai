'use client'

import { useState } from 'react'
import { useLang } from '@/context/LanguageContext'

interface Step {
  icon: string
  title: string
  desc: string
}

interface UsageGuideProps {
  title?: string
  steps: Step[]
  tips?: string[]
  defaultOpen?: boolean
  color?: 'orange' | 'teal' | 'blue' | 'purple' | 'indigo'
}

const COLOR = {
  orange: {
    header: 'bg-orange-50 border-orange-200 text-orange-700',
    badge: 'bg-orange-500',
    tip: 'bg-amber-50 border-amber-200 text-amber-800',
    btn: 'text-orange-600 hover:text-orange-700',
  },
  teal: {
    header: 'bg-teal-50 border-teal-200 text-teal-700',
    badge: 'bg-teal-500',
    tip: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    btn: 'text-teal-600 hover:text-teal-700',
  },
  blue: {
    header: 'bg-blue-50 border-blue-200 text-blue-700',
    badge: 'bg-blue-500',
    tip: 'bg-sky-50 border-sky-200 text-sky-800',
    btn: 'text-blue-600 hover:text-blue-700',
  },
  purple: {
    header: 'bg-purple-50 border-purple-200 text-purple-700',
    badge: 'bg-purple-500',
    tip: 'bg-violet-50 border-violet-200 text-violet-800',
    btn: 'text-purple-600 hover:text-purple-700',
  },
  indigo: {
    header: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    badge: 'bg-indigo-500',
    tip: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    btn: 'text-indigo-600 hover:text-indigo-700',
  },
}

export default function UsageGuide({
  title,
  steps,
  tips,
  defaultOpen = false,
  color = 'orange',
}: UsageGuideProps) {
  const { lang, t } = useLang()
  const [open, setOpen] = useState(defaultOpen)
  const c = COLOR[color]

  const displayTitle = title ?? t('guide.title')
  const isJapanese = lang === 'ja'

  return (
    <div className={`rounded-2xl border ${c.header} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <span className="text-sm font-bold">{displayTitle}</span>
        <span className={`text-xs font-semibold ${c.btn} transition-transform ${open ? 'rotate-180' : ''}`}>
          {open ? t('guide.close') : t('guide.open')}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {isJapanese ? (
            <>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className={`w-6 h-6 ${c.badge} text-white text-xs font-extrabold rounded-full flex items-center justify-center`}>
                        {i + 1}
                      </span>
                      {i < steps.length - 1 && (
                        <span className="w-0.5 h-3 bg-gray-200 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base">{step.icon}</span>
                        <span className="text-xs font-bold text-gray-800">{step.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {tips && tips.length > 0 && (
                <div className={`rounded-xl border p-3 ${c.tip}`}>
                  <p className="text-xs font-bold mb-1.5">{t('guide.point')}</p>
                  {tips.map((tip, i) => (
                    <p key={i} className="text-xs leading-relaxed">・{tip}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-500 leading-relaxed py-1">
              {t('guide.jaOnly')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
