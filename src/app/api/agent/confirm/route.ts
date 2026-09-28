import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/loop'
import { verifySessionToken } from '@/lib/agent/loop'
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
      {
        error:
          'sessionData が必要です（/api/agent/run の awaiting_approval レスポンスから取得してください）。',
      },
      { status: 400 },
    )
  }

  const sd = sessionData as AgentSessionData & { _token?: string }

  if (!sd.input || !sd.provider) {
    return NextResponse.json({ error: 'sessionData の形式が不正です。' }, { status: 400 })
  }

  // ── HMAC トークン検証 ────────────────────────────────────────────
  const tokenResult = verifySessionToken(sd._token)
  if (!tokenResult.valid) {
    console.warn('[POST /api/agent/confirm] token verification failed:', tokenResult.error)
    return NextResponse.json(
      { error: `セッションの検証に失敗しました: ${tokenResult.error}` },
      { status: 403 },
    )
  }

  // urgency の改ざん確認（トークン内の値と一致するか）
  if (
    tokenResult.payload?.urgency &&
    tokenResult.payload.urgency !== sd.input.analysisResult.urgency
  ) {
    return NextResponse.json(
      { error: 'セッションデータの緊急度が改ざんされています。' },
      { status: 403 },
    )
  }

  // 却下された場合
  if (approved === false) {
    const lang = sd.input.lang ?? 'ja'
    return NextResponse.json({
      status: 'rejected',
      steps: sd.steps ?? [],
      result: {
        ...sd.partialResult,
        summary:
          lang === 'en'
            ? `Request rejected by ${approvedBy ?? 'approver'}. Comment: ${approverComment ?? ''}`
            : `対応を却下しました（${approvedBy ?? '担当者'}）。コメント: ${approverComment ?? ''}`,
      },
    })
  }

  // 承認 OK → sessionData に承認情報を付加してループ再開
  const updatedSession: AgentSessionData = {
    ...sd,
    partialResult: {
      ...sd.partialResult,
    },
  }

  try {
    const result = await runAgent(sd.input, updatedSession, true, approvedBy)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'AGENT_TIMEOUT') {
      return NextResponse.json(
        { error: 'エージェントがタイムアウトしました（85秒）。' },
        { status: 504 },
      )
    }
    console.error('[POST /api/agent/confirm]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
