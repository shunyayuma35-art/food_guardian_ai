'use client'

import { useState } from 'react'
import { useLang } from '@/context/LanguageContext'

interface DateInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  type?: 'date' | 'datetime-local'
  quickPast?: boolean
  quickFutureOffsets?: number[]
  baseDate?: string
  warnIfBeforeDate?: string
}

function jstDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  return iso.length === 10 ? `${iso}T00:00` : iso
}

function normalizeDate(raw: string): string {
  const half = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  const normalized = half.replace(/[./・]/g, '-').replace(/\s/g, '')
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0,4)}-${normalized.slice(4,6)}-${normalized.slice(6,8)}`
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return raw
}

export default function DateInput({
  value,
  onChange,
  className = 'input-field',
  type = 'date',
  quickPast,
  quickFutureOffsets,
  baseDate,
  warnIfBeforeDate,
}: DateInputProps) {
  const { lang } = useLang()
  const isEn = lang === 'en'
  const [focused, setFocused] = useState(false)

  const inputValue = type === 'datetime-local' ? toDatetimeLocal(value) : (value ?? '')
  const isEmpty = !value
  const showOverlay = isEmpty && !focused

  function handleChange(raw: string) {
    onChange(type === 'datetime-local' ? raw : normalizeDate(raw))
  }

  const dateValue = type === 'datetime-local' ? value?.slice(0, 10) : value
  const showWarn = !!warnIfBeforeDate && !!dateValue && dateValue < warnIfBeforeDate

  const overlayText = type === 'datetime-local'
    ? (isEn ? 'Select date & time' : '日付・時刻を選択')
    : (isEn ? 'Select date' : '日付を選択')

  function setDaysAgo(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const dateStr = jstDate(d)
    if (type === 'datetime-local') {
      const now = new Date()
      onChange(`${dateStr}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)
    } else {
      onChange(dateStr)
    }
  }

  function setDaysFromBase(n: number) {
    const base = baseDate ? new Date(baseDate + 'T00:00:00') : new Date()
    if (isNaN(base.getTime())) {
      const d = new Date()
      d.setDate(d.getDate() + n)
      onChange(jstDate(d))
      return
    }
    base.setDate(base.getDate() + n)
    onChange(jstDate(base))
  }

  const pastLabels = isEn
    ? ['Today', '-1', '-2']
    : ['今日', '昨日', '一昨日']

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          type={type}
          value={inputValue}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`${className} w-full text-base${showOverlay ? ' date-empty' : ''}`}
          style={{ minHeight: '48px', fontSize: '16px' }}
        />
        {showOverlay && (
          <span
            className="absolute inset-y-0 left-0 flex items-center px-4 text-gray-400 pointer-events-none select-none"
            style={{ fontSize: '16px', right: '2.5rem' }}
            aria-hidden="true"
          >
            {overlayText}
          </span>
        )}
      </div>

      {/* 過去日付チップ */}
      {quickPast && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setDaysAgo(i)}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 active:scale-95 transition-all"
            >
              {pastLabels[i]}
            </button>
          ))}
        </div>
      )}

      {/* 未来日付オフセットチップ */}
      {quickFutureOffsets && quickFutureOffsets.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {quickFutureOffsets.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setDaysFromBase(n)}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all"
            >
              +{n}{isEn ? 'd' : '日'}
            </button>
          ))}
        </div>
      )}

      {showWarn && (
        <p className="text-[10px] text-amber-600 font-semibold">
          ⚠️ {isEn ? 'Date is before manufacturing date' : '製造日より前の日付です'}
        </p>
      )}
    </div>
  )
}
