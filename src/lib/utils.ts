/** ローカル日付を YYYY-MM-DD で返す。toISOString() は UTC 変換するため使わない。 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** ローカル日付に n 日加算して YYYY-MM-DD で返す */
export function addLocalDays(base: string, n: number): string {
  const [y, mo, d] = base.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  dt.setDate(dt.getDate() + n)
  return formatLocalDate(dt)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function generateIncidentCode(id: string): string {
  return 'FG-' + id.slice(0, 8).toUpperCase()
}

export function parseQRCode(text: string): Partial<{
  productName: string
  lotNumber: string
  manufacturingDate: string
  expiryDate: string
  lineNumber: string
  factory: string
}> {
  const result: ReturnType<typeof parseQRCode> = {}

  // GS1-128 形式: (01)GTIN(10)LOT(17)EXPIRY など
  const gs1Regex = /\((\d{2,3})\)([^(]+)/g
  let match
  let hasGs1 = false
  while ((match = gs1Regex.exec(text)) !== null) {
    hasGs1 = true
    const ai = match[1]
    const val = match[2].trim()
    if (ai === '01') result.productName = `GTIN:${val}`
    else if (ai === '10') result.lotNumber = val
    else if (ai === '17')
      result.expiryDate = `20${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 6)}`
    else if (ai === '11')
      result.manufacturingDate = `20${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 6)}`
  }
  if (hasGs1) return result

  // キーバリュー形式: LOT:xxx / 商品名:xxx など
  const lines = text.split(/[\n\r,;|]+/)
  for (const line of lines) {
    const sep = line.indexOf(':') !== -1 ? ':' : '='
    const parts = line.split(sep)
    if (parts.length < 2) continue
    const key = parts[0].trim().toLowerCase()
    const val = parts.slice(1).join(sep).trim()
    if (!val) continue

    if (/lot|ロット|batch/.test(key)) result.lotNumber = val
    else if (/product|商品|品名|name/.test(key)) result.productName = val
    else if (/mfg|製造|manufacture/.test(key)) result.manufacturingDate = val
    else if (/exp|賞味|消費|best/.test(key)) result.expiryDate = val
    else if (/line|ライン/.test(key)) result.lineNumber = val
    else if (/factory|工場|plant/.test(key)) result.factory = val
  }

  if (Object.keys(result).length === 0) {
    result.lotNumber = text.trim().slice(0, 60)
  }

  return result
}
