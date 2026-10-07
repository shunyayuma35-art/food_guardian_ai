/**
 * Language-neutral sentinel markers for AI-saved records.
 * Titles are stored as [AI:{type}:{isoDate}] or [AI:{type}:{isoDate}:{name}]
 * Location is stored as [AI_CHAT]
 * Display components parse these at render time using the current language.
 */

export const AI_CHAT_LOC_MARKER = '[AI_CHAT]'

const AI_TITLE_RE = /^\[AI:(image_analysis|ai_analysis|ai_search):(\d{4}-\d{2}-\d{2})(?::(.+))?\]$/
const LEGACY_LOC_RE = /^\(?(Recorded from AI chat|AI対話から記録|AIチャットから記録)\)?$/i

export function encodeAiTitle(
  type: 'image_analysis' | 'ai_analysis' | 'ai_search',
  isoDate: string,
  name?: string
): string {
  return name ? `[AI:${type}:${isoDate}:${name}]` : `[AI:${type}:${isoDate}]`
}

export function parseAiTitle(raw: string | null | undefined, lang: string): string {
  if (!raw) return ''
  const m = raw.match(AI_TITLE_RE)
  if (!m) return raw
  const [, type, isoDate, name] = m
  const dateStr = formatRecordDate(isoDate, lang)
  const isJa = lang !== 'en'
  switch (type) {
    case 'image_analysis':
      return isJa ? `画像解析結果 — ${dateStr}` : `Image Analysis Result — ${dateStr}`
    case 'ai_analysis':
      return isJa
        ? `AI解析: ${name ?? '不明'} — ${dateStr}`
        : `AI Analysis: ${name ?? 'Unknown'} — ${dateStr}`
    case 'ai_search':
      return isJa ? `AI検索結果 — ${dateStr}` : `AI Search Result — ${dateStr}`
    default:
      return raw
  }
}

export function parseAiLocation(raw: string | null | undefined, lang: string): string {
  if (!raw) return ''
  if (raw === AI_CHAT_LOC_MARKER || LEGACY_LOC_RE.test(raw.trim())) {
    return lang === 'en' ? 'Recorded from AI chat' : 'AIチャットから記録'
  }
  return raw
}

/** Format an ISO date string (YYYY-MM-DD) for display in the given language, without timezone shift. */
export function formatRecordDate(isoDate: string, lang: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  if (lang === 'en') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('ja-JP')
}

/** Whether a title string is an AI-generated marker (vs user text). */
export function isAiTitleMarker(raw: string | null | undefined): boolean {
  return !!raw?.match(AI_TITLE_RE)
}
