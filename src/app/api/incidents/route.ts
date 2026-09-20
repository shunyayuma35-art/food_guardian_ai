
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/incidents]', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('incidents')
      .insert([body])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[POST /api/incidents]', err)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}