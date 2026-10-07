'use client'

import { useLang } from '@/context/LanguageContext'
import { formatLocalDate } from '@/lib/utils'

interface DateInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  type?: 'date' | 'datetime-local'
  showDaysOffset?: number[]
  baseDate?: string
  warnIfBeforeDate?: string
}

/** YYYY-MM-DD → datetime-local 形式 (YYYY-MM-DDTHH:mm) に変換 */
function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  return iso.length === 10 ? `${iso}T00:00` : iso
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

  const inputValue = type === 'datetime-local' ? toDatetimeLocal(value) : (value ?? '')
  const isEmpty = !value

  function handleChange(raw: string) {
    onChange(type === 'datetime-local' ? raw : normalizeDate(raw))
  }

  const dateValue = type === 'datetime-local' ? value?.slice(0, 10) : value
  const showWarn = !!warnIfBeforeDate && !!dateValue && dateValue < warnIfBeforeDate

  const overlayText = type === 'datetime-local'
    ? (isJa ? 'YYYY / MM / DD HH:MM' : 'YYYY / MM / DD HH:MM')
    : (isJa ? '年 / 月 / 日' : 'YYYY / MM / DD')

  return (
    <div className="space-y-1">
      {/* relative ラッパーでオーバーレイを重ねる */}
      <div className="relative">
        <input
          type={type}
          value={inputValue}
          onChange={e => handleChange(e.target.value)}
          className={`${className} w-full text-base`}
          style={{ minHeight: '48px', fontSize: '16px' }}
        />
        {/* Android で placeholder が効かないためオーバーレイで代替 */}
        {isEmpty && (
          <span
            className="absolute inset-0 flex items-center px-3 text-gray-400 pointer-events-none select-none"
            style={{ fontSize: '16px' }}
            aria-hidden="true"
          >
            {overlayText}
          </span>
        )}
      </div>
      {showWarn && (
        <p className="text-[10px] text-amber-600 font-semibold">
          ⚠️ {isJa ? '製造日より前の日付です' : 'Date is before manufacturing date'}
        </p>
      )}
    </div>
  )
}
