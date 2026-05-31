import { NextRequest, NextResponse } from 'next/server'
import { readStore, upsertItem } from '@/lib/file-store'
import type { InspectionRecord } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const deviceType = req.nextUrl.searchParams.get('deviceType')
    const date = req.nextUrl.searchParams.get('date')
    let items = readStore<InspectionRecord>('inspections')
    if (userId) items = items.filter((i) => i.createdBy === userId)
    if (deviceType) items = items.filter((i) => i.deviceType === deviceType)
    if (date) items = items.filter((i) => i.inspectionDate === date)
    return NextResponse.json(items)
  } catch (err) {
    console.error('[GET /api/inspections]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: InspectionRecord = await req.json()
    if (!data?.id || !data?.createdBy || !data?.deviceName || !data?.inspector) {
      return NextResponse.json({ error: '必須フィールドが不足しています (deviceName, inspector)' }, { status: 400 })
    }
    await upsertItem('inspections', data)
    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[POST /api/inspections]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
