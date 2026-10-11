'use client'

import { useState } from 'react'
import { useLang } from '@/context/LanguageContext'

interface DateInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  type?: 'date' | 'datetime-local'
  showDaysOffset?: number[]
  baseDate?: string
  warnIfBeforeDate?: string
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
  warnIfBeforeDate,
}: DateInputProps) {
  const { t } = useLang()
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
    ? t('date.overlayDatetime')
    : t('date.overlayDate')

  return (
    <div className="space-y-1">
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
      {showWarn && (
        <p className="text-[10px] text-amber-600 font-semibold">
          ⚠️ {t('date.warnBefore')}
        </p>
      )}
    </div>
  )
}
