import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { InspectionRecord } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const deviceType = req.nextUrl.searchParams.get('deviceType')
    const date = req.nextUrl.searchParams.get('date')

    const db = getSupabaseAdmin()
    let query = db
      .from('inspections')
      .select('data')
      .order('created_at', { ascending: false })

    if (userId) query = query.eq('created_by', userId)
    if (date) query = query.eq('inspection_date', date)
    if (deviceType) query = query.eq('device_type', deviceType)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json((data ?? []).map((row) => row.data as InspectionRecord))
  } catch (err) {
    console.error('[GET /api/inspections]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const record: InspectionRecord = await req.json()
    if (!record?.id || !record?.createdBy || !record?.deviceName || !record?.inspector) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています (id, createdBy, deviceName, inspector)' },
        { status: 400 }
      )
    }

    const db = getSupabaseAdmin()
    const { error } = await db.from('inspections').upsert(
      {
        id: record.id,
        created_by: record.createdBy,
        inspection_date: record.inspectionDate,
        device_type: record.deviceType,
        data: record,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (error) throw error
    return NextResponse.json({ id: record.id })
  } catch (err) {
    console.error('[POST /api/inspections]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
