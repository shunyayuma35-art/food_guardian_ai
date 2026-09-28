import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/loop'
import type { AgentInput } from '@/lib/agent/types'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 入力バリデーション
  if (
    typeof body !== 'object' ||
    body === null ||
    !('analysisResult' in body) ||
    typeof (body as Record<string, unknown>).analysisResult !== 'object'
  ) {
    return NextResponse.json(
      { error: 'analysisResult が必要です。{ urgency, candidates, visualFeatures } を含めてください。' },
      { status: 400 },
    )
  }

  const input = body as AgentInput
  const ar = input.analysisResult

  if (!ar.urgency || !Array.isArray(ar.candidates) || !Array.isArray(ar.visualFeatures)) {
    return NextResponse.json(
      { error: 'analysisResult.urgency / candidates / visualFeatures が必要です。' },
      { status: 400 },
    )
  }

  try {
    const result = await runAgent(input)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'AGENT_TIMEOUT') {
      return NextResponse.json({ error: 'エージェントがタイムアウトしました（85秒）。' }, { status: 504 })
    }
    console.error('[POST /api/agent/run]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
