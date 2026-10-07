import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/loop'
import type { AgentInput } from '@/lib/agent/types'

export const maxDuration = 120

const MAX_HINT_LEN = 500

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('analysisResult' in body) ||
    typeof (body as Record<string, unknown>).analysisResult !== 'object'
  ) {
    return NextResponse.json(
      {
        error:
          'analysisResult が必要です。{ urgency, candidates, visualFeatures } を含めてください。',
      },
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

  if (!['high', 'medium', 'low'].includes(ar.urgency)) {
    return NextResponse.json(
      { error: 'urgency は high / medium / low のいずれかが必要です。' },
      { status: 400 },
    )
  }

  // userHint の長さ制限（サーバー側でも切り詰め）
  if (input.userHint && input.userHint.length > MAX_HINT_LEN) {
    input.userHint = input.userHint.slice(0, MAX_HINT_LEN)
  }

  // shipmentStatus の値検証
  const validShipmentStatuses = ['not_shipped', 'shipped_not_distributed', 'in_market']
  if (input.shipmentStatus && !validShipmentStatuses.includes(input.shipmentStatus)) {
    input.shipmentStatus = undefined
  }

  try {
    const result = await runAgent(input)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'AGENT_TIMEOUT') {
      return NextResponse.json(
        { error: 'エージェントがタイムアウトしました（85秒）。' },
        { status: 504 },
      )
    }
    console.error('[POST /api/agent/run]', err)
    // Gemini API エラーは詳細をサーバーログに残し、ユーザーには汎用メッセージを返す
    const userMsg = msg.includes('INVALID_ARGUMENT') || msg.includes('function response')
      ? 'AIの処理でエラーが起きました。もう一度お試しください。'
      : msg
    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
