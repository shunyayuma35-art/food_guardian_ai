import { getSupabaseAdmin } from './supabase'

export interface ConfirmedCase {
  id: string
  product_name: string
  category: string
  confirmed_name: string
  confirmed_category: string
  confirmed_subcategory?: string
  confirmation_method: string
  confirmed_by: string
  note: string
  hints: string
  ai_match: string
  created_at: string
}

const BUCKET = 'incident-images'
const CASES_PATH = 'confirmations/cases.json'
const MAX_CASES = 200

export async function loadAllCases(): Promise<ConfirmedCase[]> {
  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db.storage.from(BUCKET).download(CASES_PATH)
    if (error || !data) return []
    const text = await data.text()
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? (parsed as ConfirmedCase[]) : []
  } catch {
    return []
  }
}

export async function appendCase(
  newCase: Omit<ConfirmedCase, 'id' | 'created_at'>
): Promise<ConfirmedCase> {
  const db = getSupabaseAdmin()
  const existing = await loadAllCases()
  const record: ConfirmedCase = {
    ...newCase,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  }
  const updated = [record, ...existing].slice(0, MAX_CASES)
  const buffer = Buffer.from(JSON.stringify(updated), 'utf-8')
  const { error } = await db.storage.from(BUCKET).upload(CASES_PATH, buffer, {
    upsert: true,
    contentType: 'application/json',
  })
  if (error) throw error
  return record
}

export async function deleteCase(id: string): Promise<boolean> {
  const existing = await loadAllCases()
  const updated = existing.filter(c => c.id !== id)
  if (updated.length === existing.length) return false
  const db = getSupabaseAdmin()
  const buffer = Buffer.from(JSON.stringify(updated), 'utf-8')
  const { error } = await db.storage.from(BUCKET).upload(CASES_PATH, buffer, {
    upsert: true,
    contentType: 'application/json',
  })
  return !error
}

export async function findSimilarCases(
  productName: string,
  category: string,
  limit = 5,
  subcategory?: string
): Promise<ConfirmedCase[]> {
  const all = await loadAllCases()
  if (all.length === 0) return []
  const nameLower = (productName ?? '').toLowerCase()
  const scored = all.map(c => {
    let score = 0
    const pn = (c.product_name ?? '').toLowerCase()
    if (nameLower && (pn.includes(nameLower) || nameLower.includes(pn))) score += 3
    if (subcategory && c.confirmed_subcategory === subcategory) score += 4
    if (category && c.confirmed_category === category) score += 2
    if (category && c.category === category) score += 1
    return { c, score }
  })
  const matched = scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.c)
  return matched.length > 0 ? matched : all.slice(0, Math.min(limit, 3))
}
