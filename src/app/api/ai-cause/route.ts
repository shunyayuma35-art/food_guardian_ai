import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'

export const maxDuration = 60

function buildPrompt(inc: Record<string, unknown>, lang: string): string {
  const isEn = lang === 'en'
  const estimations = Array.isArray(inc.estimations) ? inc.estimations : []
  const est = estimations[0] ?? null
  const isAiVision = est?.source === 'ai_vision'
  const estLabel = est
    ? `${isAiVision ? '【AI画像解析結果】' : '【ルールベース推定】'}${est.category}（可能性 ${est.probability}%）`
    : '-'
  const estLabelEn = est
    ? `${isAiVision ? '[AI Image Analysis]' : '[Rule-based Estimate]'} ${est.category} (${est.probability}%)`
    : '-'

  // 異物の心当たり（コメント欄）
  const hint = String(inc.comment ?? '').trim()
  const productName = String(inc.productName ?? '')

  if (isEn) {
    const productHint = buildProductHintEn(productName)
    return `You are a food safety expert. Analyze the following foreign matter incident and generate root cause hypotheses and corrective actions.

IMPORTANT RULES:
- The AI image analysis result is the highest-priority evidence. Use it as the primary basis for your hypothesis.
- If the "Suspicion/Hint" field has content, treat it as the most important clue.
- Do NOT suggest contamination routes that contradict the foreign matter type (e.g., no metal pathway for plant matter).
- Write hypotheses consistent with the foreign matter type identified by AI.
${productHint}

Incident Data:
- Product: ${productName || '-'}
- Lot: ${inc.lotNumber ?? '-'}
- Discovery Process: ${inc.discoveryProcess ?? '-'}
- Top Estimation (PRIMARY): ${estLabelEn}
- Suspicion / Situation Notes: ${hint || '(none)'}
- Factory: ${inc.factory ?? '-'}, Line: ${inc.lineNumber ?? '-'}
- Corrective Action (recorded): ${inc.correctiveAction ?? '-'}

Respond EXACTLY in this format (no other text):

[CAUSE_4M]
Man: (hypothesis about people/training/procedure — must match the foreign matter type)
Machine: (hypothesis about equipment/tools — must match the foreign matter type)
Material: (hypothesis about raw materials/packaging/ingredients — must match the foreign matter type)
Method: (hypothesis about process/procedure — must match the foreign matter type)
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

  const productHint = buildProductHintJa(productName)
  return `あなたは食品安全の専門家です。以下の異物混入事故データをもとに、原因仮説と是正処置を生成してください。

【重要ルール】
- AI画像解析結果を最優先の根拠として使用してください。
- 「異物の心当たり」欄に入力がある場合は、それを最も重要な手がかりとして扱ってください。
- 異物の種別と矛盾する混入経路は書かないでください（例: 植物片なのに金属設備の欠損を原因とするなど）。
- AI画像解析が示す異物種別に整合する仮説を立てること。
${productHint}

事故データ:
- 製品名: ${productName || '-'}
- ロット番号: ${inc.lotNumber ?? '-'}
- 発見工程: ${inc.discoveryProcess ?? '-'}
- 第1候補推定（最優先）: ${estLabel}
- 異物の心当たり・状況コメント: ${hint || '（なし）'}
- 工場: ${inc.factory ?? '-'}、ライン: ${inc.lineNumber ?? '-'}
- 是正処置（登録済み）: ${inc.correctiveAction ?? '-'}

以下の形式で【必ずこの形式のみ】回答してください（他の文章は不要）:

[CAUSE_4M]
人(Man): （人・教育・手順に関する仮説 ── 異物種別に整合すること）
機械(Machine): （設備・機械・工具に関する仮説 ── 異物種別に整合すること）
材料(Material): （原材料・包材・副資材に関する仮説 ── 異物種別に整合すること）
方法(Method): （作業手順・管理方法に関する仮説 ── 異物種別に整合すること）
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

function buildProductHintJa(productName: string): string {
  if (!productName) return ''
  const name = productName.toLowerCase()
  const hints: string[] = []

  if (/腸|丸腸|ホルモン|モツ|内臓/.test(name)) {
    hints.push('・製品は腸・内臓系です。腸内容物（飼料・わら・穀物・植物片）の洗浄残留を優先的に検討してください。')
  }
  if (/鶏|チキン|とり/.test(name)) {
    hints.push('・鶏肉製品です。羽毛・骨・飼料（穀物・草）の残留を検討してください。')
  }
  if (/牛|ビーフ|beef/.test(name)) {
    hints.push('・牛肉製品です。飼料（わら・干し草・穀物）由来の植物片の残留を検討してください。')
  }
  if (/豚|ポーク|pork/.test(name)) {
    hints.push('・豚肉製品です。飼料や毛の残留を検討してください。')
  }
  if (/魚|シーフード|sea/.test(name)) {
    hints.push('・水産系製品です。骨・鱗・海藻の残留を検討してください。')
  }
  if (/野菜|サラダ|葉/.test(name)) {
    hints.push('・野菜系製品です。植物茎・種・土の残留を検討してください。')
  }

  return hints.length ? hints.join('\n') : ''
}

function buildProductHintEn(productName: string): string {
  if (!productName) return ''
  const name = productName.toLowerCase()
  const hints: string[] = []

  if (/intestine|offal|tripe|organ/.test(name)) {
    hints.push('- This is an intestinal/offal product. Prioritize feed residues (straw, grain, plant matter) from inadequate cleaning of intestinal contents.')
  }
  if (/chicken|poultry/.test(name)) {
    hints.push('- Poultry product. Consider feather, bone, or feed (grain, grass) residues.')
  }
  if (/beef|cattle/.test(name)) {
    hints.push('- Beef product. Consider feed residues (straw, hay, grain) as likely origin for plant-based foreign matter.')
  }

  return hints.length ? hints.join('\n') : ''
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
    const systemPrompt = lang === 'en'
      ? 'You are a food safety expert. Respond only in the specified format. Always align hypotheses with the identified foreign matter type.'
      : 'あなたは食品安全の専門家です。指定された形式のみで回答してください。異物種別に整合した仮説を立てること。'

    // 最大2回試行（失敗したら自動リトライ）
    let parsed: { cause: string; corrective: string; preventive: string; verify: string } | null = null
    let lastRaw = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callAI({
          system: systemPrompt,
          userText: prompt,
          maxTokens: 3000,
        })
        lastRaw = result.text
        const cause      = extractSection(result.text, 'CAUSE_4M')
        const corrective = extractSection(result.text, 'CORRECTIVE')
        const preventive = extractSection(result.text, 'PREVENTIVE')
        const verify     = extractSection(result.text, 'VERIFY')
        if (cause || corrective) {
          parsed = { cause, corrective, preventive, verify }
          break
        }
      } catch (e) {
        console.error(`[ai-cause] attempt ${attempt + 1} failed:`, e)
        if (attempt === 1) throw e
      }
    }

    if (!parsed) {
      const msg = lang === 'en'
        ? 'Could not parse AI response. Please try again.'
        : 'AIの応答を読み取れませんでした。もう一度お試しください。'
      console.error('[ai-cause] parse failed, raw:', lastRaw.slice(0, 200))
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[POST /api/ai-cause]', err)
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
  }
}
