import { NextRequest, NextResponse } from 'next/server'
import { readStore, upsertItem } from '@/lib/file-store'
import type { Report } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    let items = readStore<Report>('reports')
    if (userId) items = items.filter((i) => i.createdBy === userId)
    return NextResponse.json(items)
  } catch (err) {
    console.error('[GET /api/reports]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: Report = await req.json()
    if (!data?.id || !data?.createdBy) {
      return NextResponse.json({ error: '必須フィールドが不足しています' }, { status: 400 })
    }
    await upsertItem('reports', data)
    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[POST /api/reports]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
