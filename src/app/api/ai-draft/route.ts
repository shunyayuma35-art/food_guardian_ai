import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

interface DraftRequest {
  productName?: string
  comment?: string
  discoveryProcess?: string
  aiResult?: {
    name?: string
    category?: string
    urgency?: string
    route?: string[]
    action?: string
  } | null
  featuresSummary?: string
  lang?: string
}

function buildPrompt(body: DraftRequest): { system: string; userText: string } {
  const { productName, comment, discoveryProcess, aiResult, featuresSummary, lang = 'ja' } = body
  const isEn = lang === 'en'

  if (isEn) {
    const system = 'You are a food safety expert (ISO 22000 / HACCP). Generate a CAPA draft with 4 strictly separated sections. "correction" = immediate product disposition (quarantine, hold, segregation). "corrective" = root-cause-based action plan to prevent recurrence. "verification" = effectiveness verification plan with: what to confirm, timing/frequency, responsible person, acceptance criteria. "hint" = short explanation. Do NOT mix correction and corrective action. Respond ONLY in JSON format, no other text.'
    const userText = `Generate a CAPA draft for the following foreign matter incident.

Product: ${productName || '-'}
Discovery Process: ${discoveryProcess ?? '-'}
Situation / Suspicion Notes: ${comment || '(none)'}
AI Estimation (PRIMARY): ${aiResult ? `${aiResult.name ?? '-'} (${aiResult.category ?? '-'}, urgency: ${aiResult.urgency ?? '-'})` : '(none)'}
Suspected Routes: ${aiResult?.route?.join(', ') || '-'}
AI Recommended Action: ${aiResult?.action || '-'}
Checked Features: ${featuresSummary || '(none)'}

IMPORTANT: All items must be consistent with the AI-identified foreign matter type. Corrective actions must address identified root causes.

Respond in this EXACT JSON format (no other text):
{
  "corrective": ["Correction item 1 (product hold/quarantine/segregation/disposal)", "item 2", "item 3"],
  "preventive": ["Corrective action item 1 (root-cause elimination)", "item 2", "item 3"],
  "verification": "④ Verification of Effectiveness\\nWhat to confirm: ...\\nTiming/Frequency: ...\\nResponsible: ...\\nAcceptance criteria: ...",
  "hint": "2-3 line practical explanation of WHY these actions"
}`
    return { system, userText }
  }

  const system = 'あなたはISO 22000 / HACCPに精通した食品安全の専門家です。CAPA下書きを4つの区分で生成してください。①修正=今回の不適合品への処置（保留・隔離・選別・廃棄など）、③是正処置=原因を除去し再発を防ぐ行動計画（担当・期限を含む）、④有効性の検証計画=何を確認するか・いつ・誰が・判定基準。修正と是正処置を混在させないこと。指定されたJSON形式のみで回答してください。'
  const userText = `以下の異物混入事故情報をもとに、ISO 22000に準じたCAPAの下書きを生成してください。

製品名: ${productName || '-'}
発見工程: ${discoveryProcess ?? '-'}
異物の心当たり・状況コメント: ${comment || '（なし）'}
AI推定（最優先）: ${aiResult ? `${aiResult.name ?? '-'}（${aiResult.category ?? '-'}、緊急度: ${aiResult.urgency ?? '-'}）` : '（なし）'}
推定混入経路: ${aiResult?.route?.join('、') || '-'}
AI推奨対応: ${aiResult?.action || '-'}
異物特徴チェック: ${featuresSummary || '（なし）'}

【重要】AI画像解析が示す異物種別に整合すること。是正処置は特定した原因に対応させること。

以下の形式で【必ずJSONのみ】回答してください:
{
  "corrective": ["①修正項目1（当該ロット隔離・出荷保留・現物保管など）", "項目2", "項目3"],
  "preventive": ["③是正処置項目1（原因除去・再発防止）担当: ○○　期限: YYYY-MM", "項目2", "項目3"],
  "verification": "④ 有効性の検証計画\\n確認内容: ...\\n時期・頻度: ...\\n担当者: ...\\n判定基準: ...",
  "hint": "なぜこの対策か、現場向けに2〜3行で説明"
}

①修正は即時対応（ライン停止・製品隔離・現物保管・全数点検）を3〜5項目。
③是正処置は中長期の再発防止策（手順書改訂・教育・設備改善・点検強化）を3〜5項目、各項目に担当と期限の目安を入れること。
④有効性の検証計画は「確認内容・時期と頻度・担当者・判定基準」を1段落で記載すること。`

  return { system, userText }
}

function parseJsonDraft(raw: string): { corrective: string[]; preventive: string[]; verification: string; hint: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      corrective?: string[]
      preventive?: string[]
      verification?: string
      hint?: string
    }
    if (!Array.isArray(parsed.corrective) && !Array.isArray(parsed.preventive)) return null
    return {
      corrective: parsed.corrective ?? [],
      preventive: parsed.preventive ?? [],
      verification: parsed.verification ?? '',
      hint: parsed.hint ?? '',
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftRequest
    const { system, userText } = buildPrompt(body)
    const lang = body.lang ?? 'ja'
    const isEn = lang === 'en'

    // 最大2回試行（失敗したら自動リトライ）
    let parsed = null
    let lastRaw = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callAI({
          system,
          userText,
          maxTokens: 4000,
          jsonMode: true,
        })
        lastRaw = result.text
        parsed = parseJsonDraft(result.text)
        if (parsed) break
      } catch (e) {
        console.error(`[ai-draft] attempt ${attempt + 1} failed:`, e)
        if (attempt === 1) throw e
      }
    }

    if (!parsed) {
      const msg = isEn
        ? 'Could not parse AI response. Please try again.'
        : 'AIの応答を読み取れませんでした。もう一度お試しください。'
      console.error('[ai-draft] parse failed, raw:', lastRaw.slice(0, 200))
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[POST /api/ai-draft]', err)
    return NextResponse.json({ error: 'AIの応答を読み取れませんでした。もう一度お試しください。' }, { status: 500 })
  }
}
