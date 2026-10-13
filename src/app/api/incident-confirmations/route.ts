import { NextRequest, NextResponse } from 'next/server'
import { loadAllCases, appendCase, deleteCase, findSimilarCases } from '@/lib/confirmed-cases'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productName = searchParams.get('product_name') ?? ''
    const category = searchParams.get('category') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 20)

    if (!productName && !category) {
      const all = await loadAllCases()
      return NextResponse.json(all.slice(0, limit))
    }
    const cases = await findSimilarCases(productName, category, limit)
    return NextResponse.json(cases)
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
      confirmed_subcategory?: string
      confirmation_method?: string
      confirmed_by?: string
      note?: string
      hints?: string
      ai_match?: string
    }
    if (!body.confirmed_name?.trim()) {
      return NextResponse.json({ error: 'confirmed_name is required' }, { status: 400 })
    }
    const record = await appendCase({
      product_name: body.product_name ?? '',
      category: body.category ?? '',
      confirmed_name: body.confirmed_name.trim(),
      confirmed_category: body.confirmed_category ?? '',
      confirmed_subcategory: body.confirmed_subcategory ?? '',
      confirmation_method: body.confirmation_method ?? '',
      confirmed_by: body.confirmed_by ?? '',
      note: body.note ?? '',
      hints: body.hints ?? '',
      ai_match: body.ai_match ?? '未評価',
    })
    return NextResponse.json(record)
  } catch (err) {
    console.error('[POST /api/incident-confirmations]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') ?? ''
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const ok = await deleteCase(id)
    return NextResponse.json({ ok })
  } catch (err) {
    console.error('[DELETE /api/incident-confirmations]', err)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
