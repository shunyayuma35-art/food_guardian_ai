import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    const db = getSupabaseAdmin()
    const { error: uploadError } = await db.storage
      .from('incident-images')
      .upload(safeName, buffer, { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = db.storage
      .from('incident-images')
      .getPublicUrl(safeName)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[POST /api/upload]', err)
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}
