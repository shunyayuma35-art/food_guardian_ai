import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('incidents')
      .select('*')
      .eq('id', Number(id))
      .single()
    if (error) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/incidents/[id]]', err)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('incidents')
      .update(body)
      .eq('id', Number(id))
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/incidents/[id]]', err)
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
    const { error } = await db
      .from('incidents')
      .delete()
      .eq('id', Number(id))
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/incidents/[id]]', err)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
