'use client'

import { useLang } from '@/context/LanguageContext'

interface DateInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  /** 'date' or 'datetime-local' */
  type?: 'date' | 'datetime-local'
  /** +N 日ボタンを表示（賞味期限など）。製造日を基準にする */
  showDaysOffset?: number[]
  /** 基準日（YYYY-MM-DD）。未指定なら今日 */
  baseDate?: string
  /** 製造日より前なら警告（賞味期限欄に適用） */
  warnIfBeforeDate?: string
}

/** YYYY-MM-DD → datetime-local 形式 (YYYY-MM-DDTHH:mm) に変換 */
function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  return iso.length === 10 ? `${iso}T00:00` : iso
}

/** 日付文字列の自動整形（全角数字・区切り文字を正規化して YYYY-MM-DD に変換） */
function normalizeDate(raw: string): string {
  // 全角→半角
  const half = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  // 区切り文字をハイフンに統一
  const normalized = half.replace(/[./・]/g, '-').replace(/\s/g, '')
  // YYYY-MM-DD or YYYYMMDD
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0,4)}-${normalized.slice(4,6)}-${normalized.slice(6,8)}`
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return raw
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: string, n: number): string {
  const [y, mo, d] = (base || todayISO()).split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

export default function DateInput({
  value,
  onChange,
  className = 'input-field',
  type = 'date',
  showDaysOffset,
  baseDate,
  warnIfBeforeDate,
}: DateInputProps) {
  const { t, lang } = useLang()
  const isJa = lang !== 'en'
  const today = todayISO()
  const yesterday = addDays(today, -1)

  // datetime-local の場合、value は YYYY-MM-DDTHH:mm
  // date の場合、value は YYYY-MM-DD
  const inputValue = type === 'datetime-local' ? toDatetimeLocal(value) : value

  function handleChange(raw: string) {
    if (type === 'datetime-local') {
      onChange(raw)
    } else {
      onChange(normalizeDate(raw))
    }
  }

  function setToday() {
    if (type === 'datetime-local') {
      const now = new Date()
      const local = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      onChange(local)
    } else {
      onChange(today)
    }
  }

  function setYesterday() {
    if (type === 'datetime-local') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      onChange(local)
    } else {
      onChange(yesterday)
    }
  }

  const base = baseDate || today
  const usingTodayAsBase = !baseDate

  // 製造日より前の警告
  const dateValue = type === 'datetime-local' ? value?.slice(0, 10) : value
  const showWarn = !!warnIfBeforeDate && !!dateValue && dateValue < warnIfBeforeDate

  const btnClass = 'text-[10px] px-2 py-1 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg font-semibold active:scale-95 transition-all whitespace-nowrap'

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 items-center flex-wrap">
        <input
          type={type}
          value={inputValue}
          onChange={e => handleChange(e.target.value)}
          className={`${className} flex-1 min-w-0`}
        />
        <button type="button" onClick={setToday} className={btnClass}>
          {isJa ? '今日' : 'Today'}
        </button>
        <button type="button" onClick={setYesterday} className={btnClass}>
          {isJa ? '昨日' : 'Yest.'}
        </button>
      </div>

      {showDaysOffset && showDaysOffset.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {usingTodayAsBase && (
            <span className="text-[9px] text-gray-400 self-center">{isJa ? '今日基準:' : 'From today:'}</span>
          )}
          {showDaysOffset.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(addDays(base, n))}
              className={btnClass}
            >
              {n >= 365
                ? (isJa ? `+${n/365}年` : `+${n/365}y`)
                : (isJa ? `+${n}日` : `+${n}d`)}
            </button>
          ))}
        </div>
      )}

      {showWarn && (
        <p className="text-[10px] text-amber-600 font-semibold">
          ⚠️ {isJa ? '製造日より前の日付です' : 'Date is before manufacturing date'}
        </p>
      )}
    </div>
  )
}
