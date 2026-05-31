import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/file-store'

export interface MasterData {
  staff: string[]
  products: string[]
  devices: { name: string; type: 'metal_detector' | 'xray'; line?: string }[]
}

const DEFAULT: MasterData = { staff: [], products: [], devices: [] }

function readMasters(): MasterData {
  const raw = readStore<MasterData>('masters')
  return raw.length > 0 ? raw[0] : DEFAULT
}

export async function GET() {
  try {
    return NextResponse.json(readMasters())
  } catch (err) {
    console.error('[GET /api/masters]', err)
    return NextResponse.json(DEFAULT)
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: MasterData = await req.json()
    // ファイルストアはarray形式なので[data]で保存
    await writeStore('masters', [data])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/masters]', err)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
