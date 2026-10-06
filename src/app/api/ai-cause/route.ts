import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

function buildPrompt(inc: Record<string, unknown>, lang: string): string {
  const isEn = lang === 'en'
  const est = Array.isArray(inc.estimations) ? inc.estimations[0] : null

  if (isEn) {
    return `You are a food safety expert. Based on the following foreign matter incident data, generate a hypothesis for root cause and corrective actions.

Incident Data:
- Product: ${inc.productName ?? '-'}
- Lot: ${inc.lotNumber ?? '-'}
- Discovery Process: ${inc.discoveryProcess ?? '-'}
- Foreign Matter Estimation: ${est ? `${est.category} (${est.probability}%)` : '-'}
- Features: ${inc.comment ?? '-'}
- Factory: ${inc.factory ?? '-'}, Line: ${inc.lineNumber ?? '-'}
- Corrective Action (recorded): ${inc.correctiveAction ?? '-'}

Please respond EXACTLY in the following format (no other text):

[CAUSE_4M]
Man: (hypothesis about people/training/procedure)
Machine: (hypothesis about equipment/tools)
Material: (hypothesis about raw materials/packaging)
Method: (hypothesis about process/procedure)
[/CAUSE_4M]

[CORRECTIVE]
(immediate corrective actions: product quarantine, shipment hold, physical evidence preservation, etc.)
[/CORRECTIVE]

[PREVENTIVE]
(preventive measures: inspection, training, procedure revision, etc.)
[/PREVENTIVE]

[VERIFY]
(items to verify on-site to confirm root cause)
[/VERIFY]`
  }

  return `あなたは食品安全の専門家です。以下の異物混入事故データをもとに、原因仮説と是正処置を生成してください。

事故データ:
- 製品名: ${inc.productName ?? '-'}
- ロット番号: ${inc.lotNumber ?? '-'}
- 発見工程: ${inc.discoveryProcess ?? '-'}
- 異物推定: ${est ? `${est.category} (${est.probability}%)` : '-'}
- 特記事項: ${inc.comment ?? '-'}
- 工場: ${inc.factory ?? '-'}、ライン: ${inc.lineNumber ?? '-'}
- 是正処置（登録済み）: ${inc.correctiveAction ?? '-'}

以下の形式で【必ずこの形式のみ】回答してください（他の文章は不要）:

[CAUSE_4M]
人(Man): （人・教育・手順に関する仮説）
機械(Machine): （設備・機械・工具に関する仮説）
材料(Material): （原材料・包材・副資材に関する仮説）
方法(Method): （作業手順・管理方法に関する仮説）
[/CAUSE_4M]

[CORRECTIVE]
（今回の対処: 製品の隔離・出荷保留・現物保管・ライン停止など）
[/CORRECTIVE]

[PREVENTIVE]
（再発防止策: 点検強化・教育実施・手順書改訂など）
[/PREVENTIVE]

[VERIFY]
（原因を確定するために現場で確認すべき事項）
[/VERIFY]`
}

function extractSection(text: string, tag: string): string {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[/${tag}\\]`)
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const incident = body.incident as Record<string, unknown>
    const lang = (body.lang as string) ?? 'ja'

    const prompt = buildPrompt(incident, lang)
    const result = await callAI({
      system: lang === 'en'
        ? 'You are a food safety expert. Respond only in the specified format.'
        : 'あなたは食品安全の専門家です。指定された形式のみで回答してください。',
      userText: prompt,
      maxTokens: 1200,
    })

    const text = result.text
    const cause      = extractSection(text, 'CAUSE_4M')
    const corrective = extractSection(text, 'CORRECTIVE')
    const preventive = extractSection(text, 'PREVENTIVE')
    const verify     = extractSection(text, 'VERIFY')

    if (!cause && !corrective) {
      return NextResponse.json({ error: 'AI response parse failed', raw: text }, { status: 500 })
    }

    return NextResponse.json({ cause, corrective, preventive, verify })
  } catch (err) {
    console.error('[POST /api/ai-cause]', err)
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
  }
}
