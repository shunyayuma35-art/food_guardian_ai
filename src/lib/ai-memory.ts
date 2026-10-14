import { getSupabaseAdmin } from './supabase'

export interface AiMemoryRecord {
  id: string
  created_at: string
  kind: 'foreign_matter' | 'capa_draft'
  category: string
  input_summary: string
  ai_output: string
  human_final: string
  confirmed_by: string
  active: boolean
}

// 個人名・メールアドレスをマスクし500字に切り詰め
function sanitize(text: string): string {
  return (text ?? '')
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[省略]')
    .slice(0, 500)
}

export async function saveMemory(
  record: Omit<AiMemoryRecord, 'id' | 'created_at' | 'confirmed_by'>
): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    const { error } = await db.from('ai_memory').insert({
      kind: record.kind,
      category: (record.category ?? '').slice(0, 100),
      input_summary: sanitize(record.input_summary),
      ai_output: sanitize(record.ai_output),
      human_final: sanitize(record.human_final),
      confirmed_by: '', // 個人名は保存しない
      active: true,
    })
    if (error) throw error
  } catch (e) {
    console.error('[ai-memory] saveMemory failed:', e)
  }
}

export async function findMemory(
  kind: 'foreign_matter' | 'capa_draft',
  category: string,
  limit: number
): Promise<AiMemoryRecord[]> {
  try {
    const db = getSupabaseAdmin()
    const cat = (category ?? '').slice(0, 30)

    // カテゴリが指定されている場合は部分一致検索
    if (cat) {
      const { data } = await db
        .from('ai_memory')
        .select('id,created_at,kind,category,input_summary,ai_output,human_final,active')
        .eq('kind', kind)
        .eq('active', true)
        .ilike('category', `%${cat}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data && data.length > 0) return data as AiMemoryRecord[]
    }

    // カテゴリ指定なし or 一致なし → 最近の事例を返す
    const { data: fallback } = await db
      .from('ai_memory')
      .select('id,created_at,kind,category,input_summary,ai_output,human_final,active')
      .eq('kind', kind)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(cat ? Math.ceil(limit / 2) : limit)
    return (fallback as AiMemoryRecord[]) ?? []
  } catch {
    return []
  }
}

export async function listAllMemory(limit = 200): Promise<AiMemoryRecord[]> {
  try {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('ai_memory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data as AiMemoryRecord[]) ?? []
  } catch {
    return []
  }
}

export async function setMemoryActive(id: string, active: boolean): Promise<boolean> {
  try {
    const db = getSupabaseAdmin()
    const { error } = await db.from('ai_memory').update({ active }).eq('id', id)
    return !error
  } catch {
    return false
  }
}
