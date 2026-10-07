'use client'

import { useLang } from '@/context/LanguageContext'
import { formatLocalDate } from '@/lib/utils'

interface DateInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  type?: 'date' | 'datetime-local'
  /** showDaysOffset は後方互換のため残すが UI には何も出さない */
  showDaysOffset?: number[]
  baseDate?: string
  warnIfBeforeDate?: string
}

/** 日付文字列の自動整形（全角数字・区切り文字を正規化して YYYY-MM-DD に変換） */
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
  const { lang } = useLang()
  const isJa = lang !== 'en'

  function handleChange(raw: string) {
    onChange(type === 'datetime-local' ? raw : normalizeDate(raw))
  }

  const dateValue = type === 'datetime-local' ? value?.slice(0, 10) : value
  const showWarn = !!warnIfBeforeDate && !!dateValue && dateValue < warnIfBeforeDate

  return (
    <div className="space-y-1">
      <input
        type={type}
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        placeholder={isJa ? 'タップして選択' : 'Tap to select'}
        className={`${className} w-full`}
      />
      {showWarn && (
        <p className="text-[10px] text-amber-600 font-semibold">
          ⚠️ {isJa ? '製造日より前の日付です' : 'Date is before manufacturing date'}
        </p>
      )}
    </div>
  )
}
