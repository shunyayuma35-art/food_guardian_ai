import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Claude APIの解析結果をincidentsテーブルに自動保存するエンドポイント
// 使用例: POST /api/claude-save
// Body: { title, location, description, status?, image_url?, source? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, location, description, status = 'investigating', image_url = null, source } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'title と description は必須です' }, { status: 400 })
    }

    const record = {
      title,
      location: location ?? '',
      description,
      status,
      image_url,
      ...(source ? { source } : {}),
    }

    const { data, error } = await supabaseAdmin
      .from('incidents')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, incident: data })
  } catch (err) {
    console.error('[POST /api/claude-save]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

// 保存済み記録の一覧取得
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/claude-save]', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
