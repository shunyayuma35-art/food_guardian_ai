// 既存 Supabase レコードの locale 依存タイトル/場所を AI マーカー形式に変換するスクリプト
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 変換ルール
const TITLE_PATTERNS = [
  // 英語: "Image Analysis: Foreign Matter Result — M/D/YYYY"
  { re: /^Image Analysis: Foreign Matter Result\s*[—-]\s*(.+)$/, type: 'image_analysis' },
  // 日本語: "画像解析: 異物特定結果 — YYYY/M/D"
  { re: /^画像解析[:：]\s*異物特定結果\s*[—-]\s*(.+)$/, type: 'image_analysis' },
  // 英語: "Image Analysis Result — M/D/YYYY"
  { re: /^Image Analysis Result\s*[—-]\s*(.+)$/, type: 'image_analysis' },
  // 英語: "AI Analysis: {name} — M/D/YYYY"
  { re: /^AI Analysis: (.+?)\s*[—-]\s*[\d/]+$/, type: 'ai_analysis', hasName: true },
  // 日本語: "AI解析: {name} — YYYY/M/D"
  { re: /^AI解析[:：]\s*(.+?)\s*[—-]\s*[\d/]+$/, type: 'ai_analysis', hasName: true },
  // 英語: "AI Search: Foreign Matter Info — M/D/YYYY"
  { re: /^AI Search: Foreign Matter Info\s*[—-]\s*(.+)$/, type: 'ai_search' },
  // 日本語: "AI検索: 異物・害虫情報 — YYYY/M/D"
  { re: /^AI検索[:：]\s*異物[・.]害虫情報\s*[—-]\s*(.+)$/, type: 'ai_search' },
  // 英語: "AI Search Result — M/D/YYYY"
  { re: /^AI Search Result\s*[—-]\s*(.+)$/, type: 'ai_search' },
]

const LOCATION_LEGACY_RE = /^\(?(Recorded from AI chat|AI対話から記録|AIチャットから記録)\)?$/i
const AI_MARKER_RE = /^\[AI:/
const AI_CHAT_LOC_MARKER = '[AI_CHAT]'

function toIsoDate(raw) {
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

const { data: all, error } = await supabase
  .from('incidents')
  .select('id,title,location,created_at')

if (error) { console.error('fetch error', error); process.exit(1) }

console.log(`全レコード: ${all.length}件`)

let titleConverted = 0
let locConverted = 0

for (const row of all) {
  const patch = {}

  // タイトル変換
  if (row.title && !AI_MARKER_RE.test(row.title)) {
    for (const p of TITLE_PATTERNS) {
      const m = row.title.match(p.re)
      if (m) {
        const isoDate = toIsoDate(row.created_at) ?? new Date().toISOString().slice(0, 10)
        if (p.type === 'ai_analysis' && p.hasName) {
          const name = m[1]?.trim() || ''
          patch.title = `[AI:ai_analysis:${isoDate}:${name}]`
        } else {
          patch.title = `[AI:${p.type}:${isoDate}]`
        }
        break
      }
    }
  }

  // 場所変換
  if (row.location && LOCATION_LEGACY_RE.test(row.location.trim()) && row.location.trim() !== AI_CHAT_LOC_MARKER) {
    patch.location = AI_CHAT_LOC_MARKER
  }

  if (Object.keys(patch).length === 0) continue

  const { error: upErr } = await supabase.from('incidents').update(patch).eq('id', row.id)
  if (upErr) {
    console.error(`  id=${row.id} 更新失敗:`, upErr.message)
  } else {
    const fields = Object.keys(patch)
    if (fields.includes('title')) { console.log(`  id=${row.id} title: "${row.title}" → "${patch.title}"`); titleConverted++ }
    if (fields.includes('location')) { console.log(`  id=${row.id} location: "${row.location}" → "${patch.location}"`); locConverted++ }
  }
}

console.log(`\n完了: タイトル ${titleConverted}件、場所 ${locConverted}件 を変換しました`)
