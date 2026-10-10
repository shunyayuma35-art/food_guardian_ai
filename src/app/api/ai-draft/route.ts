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
    const system = 'You are a food safety expert. Generate corrective actions and preventive measures based on the incident data. Align all content with the foreign matter type identified by AI. Respond ONLY in the specified JSON format, no other text.'
    const userText = `Generate a draft for corrective actions and preventive measures based on the following foreign matter incident.

Product: ${productName || '-'}
Discovery Process: ${discoveryProcess ?? '-'}
Situation / Suspicion Notes: ${comment || '(none)'}
AI Estimation (PRIMARY): ${aiResult ? `${aiResult.name ?? '-'} (${aiResult.category ?? '-'}, urgency: ${aiResult.urgency ?? '-'})` : '(none)'}
Suspected Routes: ${aiResult?.route?.join(', ') || '-'}
AI Recommended Action: ${aiResult?.action || '-'}
Checked Features: ${featuresSummary || '(none)'}

IMPORTANT: All corrective/preventive items must be consistent with the AI-identified foreign matter type.

Respond in this EXACT JSON format (no other text):
{
  "corrective": ["item 1", "item 2", "item 3"],
  "preventive": ["item 1", "item 2", "item 3"],
  "hint": "2-3 line practical hint for the team explaining WHY these actions"
}`
    return { system, userText }
  }

  const system = 'あなたは食品安全の専門家です。異物混入事故データをもとに是正処置と再発防止策を生成してください。AI画像解析が示す異物種別に整合した内容にすること。指定されたJSON形式のみで回答してください。他の文章は一切不要です。'
  const userText = `以下の異物混入事故情報をもとに、是正処置と再発防止策の下書きを生成してください。

製品名: ${productName || '-'}
発見工程: ${discoveryProcess ?? '-'}
異物の心当たり・状況コメント: ${comment || '（なし）'}
AI推定（最優先）: ${aiResult ? `${aiResult.name ?? '-'}（${aiResult.category ?? '-'}、緊急度: ${aiResult.urgency ?? '-'}）` : '（なし）'}
推定混入経路: ${aiResult?.route?.join('、') || '-'}
AI推奨対応: ${aiResult?.action || '-'}
異物特徴チェック: ${featuresSummary || '（なし）'}

【重要】是正処置・再発防止策は、AI画像解析が示す異物種別に整合すること。

以下の形式で【必ずJSONのみ】回答してください:
{
  "corrective": ["項目1", "項目2", "項目3"],
  "preventive": ["項目1", "項目2", "項目3"],
  "hint": "なぜこの対策か、新人向けに2〜3行で説明"
}

是正処置は即時対応（ライン停止・製品隔離・現物保管・全数点検など）を3〜5項目。
再発防止策は中長期対策（手順書改訂・教育・設備改善・点検強化など）を3〜5項目。`

  return { system, userText }
}

function parseJsonDraft(raw: string): { corrective: string[]; preventive: string[]; hint: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      corrective?: string[]
      preventive?: string[]
      hint?: string
    }
    if (!Array.isArray(parsed.corrective) && !Array.isArray(parsed.preventive)) return null
    return {
      corrective: parsed.corrective ?? [],
      preventive: parsed.preventive ?? [],
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
