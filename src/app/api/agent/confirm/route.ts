import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/loop'
import type { AgentSessionData } from '@/lib/agent/types'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'リクエストボディが必要です。' }, { status: 400 })
  }

  const { sessionData, approved, approvedBy, approverComment } = body as {
    sessionData?: unknown
    approved?: boolean
    approvedBy?: string
    approverComment?: string
  }

  if (!sessionData || typeof sessionData !== 'object') {
    return NextResponse.json(
      { error: 'sessionData が必要です（/api/agent/run の awaiting_approval レスポンスから取得してください）。' },
      { status: 400 },
    )
  }

  const sd = sessionData as AgentSessionData
  if (!sd.input || !sd.provider) {
    return NextResponse.json({ error: 'sessionData の形式が不正です。' }, { status: 400 })
  }

  if (approved === false) {
    return NextResponse.json({
      status: 'rejected',
      steps: sd.steps ?? [],
      result: { ...sd.partialResult, summary: `対応を却下しました。コメント: ${approverComment ?? ''}` },
    })
  }

  // 承認OK → ループを再開。承認者情報をpartialResultに付加する
  const updatedSession: AgentSessionData = {
    ...sd,
    partialResult: {
      ...sd.partialResult,
      summary: `承認者: ${approvedBy ?? '不明'}。${approverComment ? `コメント: ${approverComment}` : ''}`,
    },
  }

  try {
    const result = await runAgent(
      sd.input,
      updatedSession,
      true,
      approvedBy,
    )
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'AGENT_TIMEOUT') {
      return NextResponse.json({ error: 'エージェントがタイムアウトしました（85秒）。' }, { status: 504 })
    }
    console.error('[POST /api/agent/confirm]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
