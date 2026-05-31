import { NextRequest, NextResponse } from 'next/server'
import { readStore, upsertItem } from '@/lib/file-store'
import type { Incident } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const lotNumber = req.nextUrl.searchParams.get('lotNumber')
    let items = readStore<Incident>('incidents')
    if (userId) items = items.filter((i) => i.createdBy === userId)
    if (lotNumber) items = items.filter((i) => i.lotNumber === lotNumber)
    return NextResponse.json(items)
  } catch (err) {
    console.error('[GET /api/incidents]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: Incident = await req.json()
    if (!data?.id || !data?.createdBy) {
      return NextResponse.json({ error: '必須フィールドが不足しています (id, createdBy)' }, { status: 400 })
    }
    await upsertItem('incidents', data)
    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[POST /api/incidents]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
