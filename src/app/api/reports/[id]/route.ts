import { NextRequest, NextResponse } from 'next/server'
import { readStore, updateItem, deleteItem } from '@/lib/file-store'
import type { Report } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const item = readStore<Report>('reports').find((i) => i.id === id)
    if (!item) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(item)
  } catch (err) {
    console.error('[GET /api/reports/[id]]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await req.json()
    delete data.id
    const found = await updateItem<Report>('reports', id, data)
    if (!found) return NextResponse.json({ error: '報告書が見つかりません' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/reports/[id]]', err)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteItem('reports', id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/reports/[id]]', err)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
