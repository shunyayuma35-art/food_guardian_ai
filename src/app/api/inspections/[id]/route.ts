import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { InspectionRecord } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('inspections')
      .select('data')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json(null, { status: 404 })
      throw error
    }
    return NextResponse.json(data?.data ?? null)
  } catch (err) {
    console.error('[GET /api/inspections/[id]]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const patch = await req.json()
    delete patch.id

    const db = getSupabaseAdmin()

    // 既存レコードを取得してマージ
    const { data: current, error: fetchErr } = await db
      .from('inspections')
      .select('data')
      .eq('id', id)
      .single()

    if (fetchErr) {
      if (fetchErr.code === 'PGRST116') {
        return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
      }
      throw fetchErr
    }

    const merged: InspectionRecord = {
      ...(current?.data as InspectionRecord),
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    }

    const { error } = await db
      .from('inspections')
      .update({
        data: merged,
        inspection_date: merged.inspectionDate,
        device_type: merged.deviceType,
        updated_at: merged.updatedAt,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/inspections/[id]]', err)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getSupabaseAdmin()
    const { error } = await db.from('inspections').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/inspections/[id]]', err)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
