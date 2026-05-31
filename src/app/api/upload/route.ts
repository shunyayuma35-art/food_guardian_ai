import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

export async function POST(req: NextRequest) {
  try {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filepath = join(UPLOAD_DIR, safeName)

    writeFileSync(filepath, buffer)

    return NextResponse.json({ url: `/uploads/${safeName}` })
  } catch (err) {
    console.error('[POST /api/upload]', err)
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}

export const config = { api: { bodyParser: false } }
