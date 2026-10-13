import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 30

interface PdcaActionRequest {
  pdcaStatus?: string
  pdcaDeadline?: string
  productName?: string
  editedCorrective?: string
  editedCause?: string
  editedPreventive?: string
  verifyWhat?: string
  verifyWhen?: string
  verifyWho?: string
  verifyCriteria?: string
  lang?: string
}

function futureDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function fixPastDates(text: string): string {
  const today = new Date()
  return text.replace(/\b(20[0-9]{2})[/\-](0[1-9]|1[0-2])(?:[/\-](0[1-9]|[12]\d|3[01]))?\b/g, (match, year, month, day) => {
    try {
      const d = new Date(`${year}-${month}-${day ?? '01'}`)
      return d < today ? futureDate(14) : match
    } catch { return match }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PdcaActionRequest
    const lang = body.lang ?? 'ja'
    const isEn = lang === 'en'
    const today = new Date().toISOString().slice(0, 10)

    const statusLabel: Record<string, string> = {
      planned: isEn ? 'Planned' : '計画中',
      doing: isEn ? 'In Progress' : '実施中',
      checking: isEn ? 'Checking' : '確認中',
      done: isEn ? 'Done' : '完了',
    }

    const system = isEn
      ? 'You are a food safety expert and PDCA facilitator. Generate concrete next action items (3–5 lines) for a CAPA task. Dates must be YYYY/MM/DD format and future dates only. Be specific: include roles, deadlines, and what to check. Output plain text only, no bullets or JSON.'
      : 'あなたは食品安全のPDCA推進担当者です。CAPA対応の「次にやるべきアクション」を3〜5行で具体的に提案してください。日付はYYYY/MM/DD形式で今日以降の日付のみ。役割・期限・確認内容を具体的に記載してください。箇条書きも可。プレーンテキストのみ出力してください。'

    const userText = isEn ? `
Today: ${today}
Product: ${body.productName || '-'}
Current PDCA Status: ${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus ?? '-'}
Deadline: ${body.pdcaDeadline || '-'}

① Correction (done): ${body.editedCorrective || '-'}
② Root Cause: ${body.editedCause || '-'}
③ Corrective Action (plan): ${body.editedPreventive || '-'}
④ Verification plan:
  - What: ${body.verifyWhat || '-'}
  - When/Freq: ${body.verifyWhen || '-'}
  - Who: ${body.verifyWho || '-'}
  - Criteria: ${body.verifyCriteria || '-'}

Based on the current status "${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus}", generate 3–5 specific next action items with YYYY/MM/DD deadlines.
For "Planned": focus on drafting SOPs, scheduling training, assigning owners.
For "In Progress": focus on executing the plan, tracking milestones.
For "Checking": focus on verifying effectiveness: count incidents, review records, check criteria met.
For "Done": focus on closing documentation and communicating results.

Note: All dates must be after today (${today}). If deadline is near, prioritize urgent items.
Output plain text (no JSON, no headers), 3–5 lines max.`
      : `
今日: ${today}
製品名: ${body.productName || '-'}
現在のPDCA段階: ${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus ?? '-'}
期限: ${body.pdcaDeadline || '-'}

① 修正（実施済み）: ${body.editedCorrective || '-'}
② 原因: ${body.editedCause || '-'}
③ 是正処置（計画）: ${body.editedPreventive || '-'}
④ 有効性の検証計画:
  ・確認内容: ${body.verifyWhat || '-'}
  ・時期・頻度: ${body.verifyWhen || '-'}
  ・担当者: ${body.verifyWho || '-'}
  ・判定基準: ${body.verifyCriteria || '-'}

現在の段階「${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus}」に合わせて、次にやるべきアクションを3〜5項目、具体的に提案してください。
計画中 → SOPの改訂案作成・研修のスケジュール・担当者の割り当てなど
実施中 → 手順の実行・進捗確認・期限管理など
確認中 → 有効性の確認（同種異物の発生件数集計・記録チェック・判定基準との照合）
完了 → クロージング・結果の共有・文書化

日付は今日（${today}）以降のYYYY/MM/DD形式で記載すること。期限が近い場合は優先度を上げること。
プレーンテキストのみ、3〜5行以内で出力してください。`

    const result = await callAI({ system, userText, maxTokens: 600 })
    const text = fixPastDates(result.text.trim())
    return NextResponse.json({ suggestion: text })
  } catch (err) {
    console.error('[ai-pdca-action]', err)
    return NextResponse.json({ error: 'AI提案の生成に失敗しました' }, { status: 500 })
  }
}
