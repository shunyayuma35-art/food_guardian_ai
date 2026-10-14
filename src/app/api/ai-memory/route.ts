import { NextResponse } from 'next/server'
import { listAllMemory, saveMemory, setMemoryActive } from '@/lib/ai-memory'

export async function GET() {
  try {
    const records = await listAllMemory(200)
    return NextResponse.json({ records })
  } catch (e) {
    console.error('[api/ai-memory GET]', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { kind, category, input_summary, ai_output, human_final } = body
    if (!kind || !human_final) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    await saveMemory({ kind, category: category ?? '', input_summary: input_summary ?? '', ai_output: ai_output ?? '', human_final, active: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/ai-memory POST]', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, active } = body
    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    const ok = await setMemoryActive(id, active)
    return NextResponse.json({ ok })
  } catch (e) {
    console.error('[api/ai-memory PATCH]', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
