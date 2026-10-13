import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productName = searchParams.get('product_name') ?? ''
    const category = searchParams.get('category') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 10)

    const db = getSupabaseAdmin()
    let query = db
      .from('incident_confirmations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit * 3)

    const { data, error } = await query
    if (error) throw error

    // 類似度フィルタ（product_name部分一致 or category一致を優先）
    const rows = (data ?? []) as Array<Record<string, unknown>>
    const scored = rows.map(row => {
      let score = 0
      if (productName && String(row.product_name ?? '').includes(productName)) score += 2
      if (productName && productName.includes(String(row.product_name ?? ''))) score += 1
      if (category && row.category === category) score += 2
      if (category && String(row.category ?? '').includes(category)) score += 1
      return { ...row, _score: score }
    })
    const filtered = scored
      .filter(r => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score: _, ...rest }) => rest)

    const result = filtered.length > 0 ? filtered : rows.slice(0, limit)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/incident-confirmations]', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      product_name?: string
      category?: string
      confirmed_name: string
      confirmed_category?: string
      hints?: string
      ai_match?: string
    }
    if (!body.confirmed_name?.trim()) {
      return NextResponse.json({ error: 'confirmed_name is required' }, { status: 400 })
    }
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('incident_confirmations')
      .insert([{
        product_name: body.product_name ?? '',
        category: body.category ?? '',
        confirmed_name: body.confirmed_name,
        confirmed_category: body.confirmed_category ?? '',
        hints: body.hints ?? '',
        ai_match: body.ai_match ?? '未評価',
      }])
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[POST /api/incident-confirmations]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
