import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

interface DraftRequest {
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
  const { comment, discoveryProcess, aiResult, featuresSummary, lang = 'ja' } = body
  const isEn = lang === 'en'

  if (isEn) {
    const system = 'You are a food safety expert. Generate corrective actions and preventive measures based on the incident data. Respond ONLY in the specified JSON format.'
    const userText = `Generate a draft for corrective actions and preventive measures based on the following foreign matter incident.

Discovery Process: ${discoveryProcess ?? '-'}
Situation Notes: ${comment || '(none)'}
AI Estimation: ${aiResult ? `${aiResult.name ?? '-'} (${aiResult.category ?? '-'}, urgency: ${aiResult.urgency ?? '-'})` : '(none)'}
Suspected Routes: ${aiResult?.route?.join(', ') || '-'}
AI Recommended Action: ${aiResult?.action || '-'}
Checked Features: ${featuresSummary || '(none)'}

Respond in this EXACT JSON format (no other text):
{
  "corrective": ["item 1", "item 2", "item 3"],
  "preventive": ["item 1", "item 2", "item 3"],
  "hint": "2-3 line practical hint for the team"
}`
    return { system, userText }
  }

  const system = 'あなたは食品安全の専門家です。異物混入事故データをもとに是正処置と再発防止策を生成してください。指定されたJSON形式のみで回答してください。'
  const userText = `以下の異物混入事故情報をもとに、是正処置と再発防止策の下書きを生成してください。

発見工程: ${discoveryProcess ?? '-'}
状況コメント: ${comment || '（なし）'}
AI推定: ${aiResult ? `${aiResult.name ?? '-'}（${aiResult.category ?? '-'}、緊急度: ${aiResult.urgency ?? '-'}）` : '（なし）'}
推定混入経路: ${aiResult?.route?.join('、') || '-'}
AI推奨対応: ${aiResult?.action || '-'}
異物特徴チェック: ${featuresSummary || '（なし）'}

以下の形式で【必ずJSONのみ】回答してください（他の文章は不要）:
{
  "corrective": ["項目1", "項目2", "項目3"],
  "preventive": ["項目1", "項目2", "項目3"],
  "hint": "現場チームへの実践的なヒント（2〜3行）"
}

是正処置は即時対応（ライン停止・製品隔離・現物保管・全数点検など）を3〜5項目。
再発防止策は中長期対策（手順書改訂・教育・設備改善・点検強化など）を3〜5項目。
ヒントは「考え方」「見落としがちな点」「現場での優先順位」を2〜3行で。`

  return { system, userText }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftRequest
    const { system, userText } = buildPrompt(body)

    const result = await callAI({ system, userText, maxTokens: 800 })

    // JSON を抽出（```json ... ``` でラップされる場合も対応）
    const raw = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: 'parse_failed', raw: result.text }, { status: 500 })
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      corrective?: string[]
      preventive?: string[]
      hint?: string
    }

    return NextResponse.json({
      corrective: parsed.corrective ?? [],
      preventive: parsed.preventive ?? [],
      hint: parsed.hint ?? '',
    })
  } catch (err) {
    console.error('[POST /api/ai-draft]', err)
    return NextResponse.json({ error: 'AI draft failed' }, { status: 500 })
  }
}
