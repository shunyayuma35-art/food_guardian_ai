import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

export interface VerificationObj {
  what: string
  when: string
  who: string
  criteria: string
}

interface DraftRequest {
  productName?: string
  comment?: string
  discoveryProcess?: string
  discoveryDate?: string
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

function futureDateStr(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 24 * 3600 * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function fixPastDates(items: string[], discoveryDate?: string): string[] {
  const today = new Date()
  const base = discoveryDate ? new Date(discoveryDate) : today
  const fallback = futureDateStr(isNaN(base.getTime()) ? today : base, 30)
  return items.map(item =>
    item.replace(/\b(20[0-9]{2})[/\-](0[1-9]|1[0-2])(?:[/\-](0[1-9]|[12]\d|3[01]))?\b/g, (match, year, month, day) => {
      try {
        const d = new Date(`${year}-${month}-${day ?? '01'}`)
        return d < today ? fallback : match
      } catch { return match }
    })
  )
}

function buildPrompt(body: DraftRequest): { system: string; userText: string } {
  const { productName, comment, discoveryProcess, discoveryDate, aiResult, featuresSummary, lang = 'ja' } = body
  const isEn = lang === 'en'

  const today = new Date().toISOString().slice(0, 10)
  const baseDate = discoveryDate ? new Date(discoveryDate) : new Date()
  const deadlineMin = futureDateStr(isNaN(baseDate.getTime()) ? new Date() : baseDate, 14)
  const deadlineMax = futureDateStr(isNaN(baseDate.getTime()) ? new Date() : baseDate, 90)

  if (isEn) {
    const system = 'You are a food safety expert (ISO 22000 / HACCP). Generate a CAPA draft with 4 strictly separated sections. "corrective" = immediate product disposition (quarantine, hold, segregation). "preventive" = root-cause-based action plan to prevent recurrence. "verification" = effectiveness verification plan as a JSON object with 4 keys. Do NOT mix correction and corrective action. Respond ONLY in JSON format, no other text.'
    const userText = `Generate a CAPA draft for the following foreign matter incident.

Product: ${productName || '-'}
Discovery Process: ${discoveryProcess ?? '-'}
Discovery Date: ${discoveryDate ?? '-'}
Today's Date: ${today}
Situation / Suspicion Notes: ${comment || '(none)'}
AI Estimation (PRIMARY): ${aiResult ? `${aiResult.name ?? '-'} (${aiResult.category ?? '-'}, urgency: ${aiResult.urgency ?? '-'})` : '(none)'}
Suspected Routes: ${aiResult?.route?.join(', ') || '-'}
AI Recommended Action: ${aiResult?.action || '-'}
Checked Features: ${featuresSummary || '(none)'}

IMPORTANT:
- All items must be consistent with the AI-identified foreign matter type.
- Corrective action deadlines MUST be in YYYY/MM/DD format and MUST be between ${deadlineMin} and ${deadlineMax} (14–90 days after discovery date). Never use past dates.
- Responsible persons should be generic roles (e.g., QA Dept., Line Manager).

Respond in this EXACT JSON format (no other text):
{
  "corrective": ["Correction item 1 (product hold/quarantine/segregation/disposal)", "item 2", "item 3"],
  "preventive": ["Corrective action item 1 — Responsible: [role]  Deadline: ${deadlineMin}", "item 2", "item 3"],
  "verification": {
    "what": "What to confirm (e.g., no recurrence of same foreign matter type)",
    "when": "Timing / frequency (e.g., weekly for 1 month after implementation)",
    "who": "Responsible person / department",
    "criteria": "Acceptance criteria (e.g., 0 incidents of same type for 3 months)"
  },
  "hint": "2-3 line practical explanation of WHY these actions"
}`
    return { system, userText }
  }

  const system = 'あなたはISO 22000 / HACCPに精通した食品安全の専門家です。CAPA下書きを4つの区分で生成してください。①修正=今回の不適合品への処置（保留・隔離・選別・廃棄など）、③是正処置=原因を除去し再発を防ぐ行動計画（担当・期限を含む）、④有効性の検証計画=4つのキーを持つJSONオブジェクトで返すこと。修正と是正処置を混在させないこと。指定されたJSON形式のみで回答してください。'
  const userText = `以下の異物混入事故情報をもとに、ISO 22000に準じたCAPAの下書きを生成してください。

製品名: ${productName || '-'}
発見工程: ${discoveryProcess ?? '-'}
発見日: ${discoveryDate ?? '-'}
今日の日付: ${today}
異物の心当たり・状況コメント: ${comment || '（なし）'}
AI推定（最優先）: ${aiResult ? `${aiResult.name ?? '-'}（${aiResult.category ?? '-'}、緊急度: ${aiResult.urgency ?? '-'}）` : '（なし）'}
推定混入経路: ${aiResult?.route?.join('、') || '-'}
AI推奨対応: ${aiResult?.action || '-'}
異物特徴チェック: ${featuresSummary || '（なし）'}

【重要ルール】
- AI画像解析が示す異物種別に整合すること。
- ③是正処置の各項目に「担当: ○○　期限: YYYY/MM/DD」の形式で期限を記入すること。
- 期限は必ず ${deadlineMin} 〜 ${deadlineMax}（発見日から2週間〜3か月後）の範囲で YYYY/MM/DD 形式にすること。過去の日付は絶対に使わないこと。
- ④有効性の検証計画は必ず4つのキーを持つJSONオブジェクトで返すこと。

以下の形式で【必ずJSONのみ】回答してください:
{
  "corrective": ["①修正項目1（当該ロット隔離・出荷保留・現物保管など）", "項目2", "項目3"],
  "preventive": ["③是正処置項目1（原因除去・再発防止）担当: ○○　期限: ${deadlineMin}", "項目2", "項目3"],
  "verification": {
    "what": "確認内容（例: 同種異物の再発がないこと）",
    "when": "時期・頻度（例: 実施後1か月間、毎週）",
    "who": "担当者（例: 品質管理部）",
    "criteria": "判定基準（例: 同種異物の発生0件、点検記録の記入漏れ0件）"
  },
  "hint": "なぜこの対策か、現場向けに2〜3行で説明"
}

①修正は即時対応（ライン停止・製品隔離・現物保管・全数点検）を3〜5項目。
③是正処置は中長期の再発防止策（手順書改訂・教育・設備改善・点検強化）を3〜5項目。
④有効性の検証計画は4つのキーwhat/when/who/criteriaをすべて記入すること。`

  return { system, userText }
}

function parseVerificationObj(v: unknown): VerificationObj {
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    return {
      what: String(o.what ?? ''),
      when: String(o.when ?? ''),
      who: String(o.who ?? ''),
      criteria: String(o.criteria ?? ''),
    }
  }
  if (typeof v === 'string') {
    const result: VerificationObj = { what: '', when: '', who: '', criteria: '' }
    for (const line of v.split('\n')) {
      if (/^(?:確認内容|What)[：: ]/i.test(line)) result.what = line.replace(/^[^：:]+[：: ]\s*/, '').trim()
      else if (/^(?:時期|Timing)[：: ]/i.test(line)) result.when = line.replace(/^[^：:]+[：: ]\s*/, '').trim()
      else if (/^(?:担当者|Responsible)[：: ]/i.test(line)) result.who = line.replace(/^[^：:]+[：: ]\s*/, '').trim()
      else if (/^(?:判定基準|Acceptance)[：: ]/i.test(line)) result.criteria = line.replace(/^[^：:]+[：: ]\s*/, '').trim()
    }
    return result
  }
  return { what: '', when: '', who: '', criteria: '' }
}

interface ParsedDraft {
  corrective: string[]
  preventive: string[]
  verification: VerificationObj
  hint: string
}

function parseJsonDraft(raw: string): ParsedDraft | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
    if (!Array.isArray(parsed.corrective) && !Array.isArray(parsed.preventive)) return null
    return {
      corrective: Array.isArray(parsed.corrective) ? (parsed.corrective as string[]) : [],
      preventive: Array.isArray(parsed.preventive) ? (parsed.preventive as string[]) : [],
      verification: parseVerificationObj(parsed.verification),
      hint: typeof parsed.hint === 'string' ? parsed.hint : '',
    }
  } catch {
    return null
  }
}

function hasVerification(d: ParsedDraft): boolean {
  return !!(d.verification.what || d.verification.when || d.verification.who || d.verification.criteria)
}

function fillVerificationDefaults(v: VerificationObj, isEn: boolean): VerificationObj {
  if (isEn) return {
    what: v.what || 'No recurrence of the same type of foreign matter',
    when: v.when || 'Weekly for 1 month after implementation, then monthly for 3 months',
    who: v.who || 'QA Department',
    criteria: v.criteria || '0 incidents of same type for 3 months, 0 missed inspection records',
  }
  return {
    what: v.what || '同種異物の再発がないこと・該当工程の点検記録に問題がないこと',
    when: v.when || '是正処置実施から1か月間は毎週、その後3か月間は毎月',
    who: v.who || '品質管理責任者',
    criteria: v.criteria || '同種異物の発生0件・点検記録の記入漏れ0件',
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftRequest
    const { system, userText } = buildPrompt(body)
    const lang = body.lang ?? 'ja'
    const isEn = lang === 'en'

    let parsed: ParsedDraft | null = null
    let lastRaw = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await Promise.race([
          callAI({ system, userText, maxTokens: 4000, jsonMode: true }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000)),
        ])
        lastRaw = result.text
        parsed = parseJsonDraft(result.text)
        if (parsed && hasVerification(parsed)) break
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

    // 空フィールドにデフォルト値を補完（絶対に空欄にしない）
    parsed.verification = fillVerificationDefaults(parsed.verification, isEn)

    // 過去日付をサーバー側で修正
    parsed.preventive = fixPastDates(parsed.preventive, body.discoveryDate)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[POST /api/ai-draft]', err)
    return NextResponse.json({ error: 'AIの応答を読み取れませんでした。もう一度お試しください。' }, { status: 500 })
  }
}
