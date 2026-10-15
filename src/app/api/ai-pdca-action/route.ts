import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

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
  latestCorrectiveDeadline?: string
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

// 末尾が文末句読点で終わらない最後の項目を削除（Geminiの思考トークンによる途中切れ対策）
function trimIncomplete(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) return text
  const last = lines[lines.length - 1]
  if (!/[。.！!？?」』）\)]$/.test(last)) {
    return lines.slice(0, -1).join('\n')
  }
  return lines.join('\n')
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

    const closingNote = body.latestCorrectiveDeadline
      ? (isEn
        ? `IMPORTANT: The latest corrective action deadline is ${body.latestCorrectiveDeadline}. Any closing or completion date MUST be after this date.`
        : `重要: ③是正処置の最終期限は${body.latestCorrectiveDeadline}です。クロージング・完了・確認完了などの日付は必ずこれ以降の日付にすること。`)
      : ''

    const system = isEn
      ? `You are a food safety expert and PDCA facilitator. Generate exactly 3 next action items for a CAPA task.
Rules:
- Each item must be one complete sentence ending with a period, at most 100 characters.
- Dates must be YYYY/MM/DD format and future dates only.
- Include role and deadline per item.
- Do NOT copy product names, foreign matter types, or dates from any other incident. Use only the current incident data.
- Output plain text only, no bullets, no JSON, no headers.`
      : `あなたは食品安全のPDCA推進担当者です。CAPA対応の「次にやるべきアクション」をちょうど3項目、具体的に提案してください。
ルール:
- 各項目は1文・完結した文章にし、必ず「。」で終わらせること。1項目は100文字以内。
- 日付はYYYY/MM/DD形式で今日（${today}）以降の日付のみ。
- 各項目に役割・期限を含めること。
- 他の事故の製品名・異物名・日付は絶対に出力に含めないこと。目の前の事故情報だけを使うこと。
- プレーンテキストのみ。箇条書き記号は使わなくてよい。`

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
${closingNote}

Based on the current status "${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus}", generate exactly 3 next action items.
For "Planned": drafting SOPs, scheduling training, assigning owners.
For "In Progress": executing the plan, tracking milestones.
For "Checking": verifying effectiveness, counting incidents, reviewing records.
For "Done": closing documentation, communicating results.

Output exactly 3 lines, each a complete sentence ending with a period, max 100 chars each.`
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
${closingNote}

現在の段階「${statusLabel[body.pdcaStatus ?? ''] ?? body.pdcaStatus}」に合わせ、次にやるべきアクションをちょうど3項目、具体的に提案してください。
計画中 → SOPの改訂案作成・研修のスケジュール・担当者の割り当てなど
実施中 → 手順の実行・進捗確認・期限管理など
確認中 → 有効性の確認（同種異物の発生件数集計・記録チェック・判定基準との照合）
完了 → クロージング・結果の共有・文書化

3行ちょうど出力し、各行を「。」で終わること。1行100文字以内。`

    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await Promise.race([
          callAI({ system, userText, maxTokens: 1500 }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000)),
        ])
        const text = trimIncomplete(fixPastDates(result.text.trim()))
        return NextResponse.json({ suggestion: text })
      } catch (e) {
        console.error(`[ai-pdca-action] attempt ${attempt + 1} failed:`, e)
        lastErr = e
      }
    }
    throw lastErr
  } catch (err) {
    console.error('[ai-pdca-action]', err)
    return NextResponse.json({ error: 'AI提案の生成に失敗しました' }, { status: 500 })
  }
}
