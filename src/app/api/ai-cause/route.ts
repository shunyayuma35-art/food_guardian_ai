import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-provider'
import { findSimilarCases } from '@/lib/confirmed-cases'

export const maxDuration = 60

function buildFeaturesSummary(inc: Record<string, unknown>, lang: string): string {
  const features = inc.features as Record<string, Record<string, unknown>> | undefined
  if (!features) return ''
  const isEn = lang === 'en'
  const groupNone = (inc.features as Record<string, Record<string, boolean>>)?.groupNone ?? {}
  const groupUnknown = (inc.features as Record<string, Record<string, boolean>>)?.groupUnknown ?? {}

  const labelMap: Record<string, Record<string, string>> = {
    texture: { hard: isEn ? 'Hard' : '硬い', soft: isEn ? 'Soft' : '柔らかい', elastic: isEn ? 'Elastic' : '弾力あり', crumbly: isEn ? 'Crumbly' : 'もろい', sticky: isEn ? 'Sticky' : 'べたつく', sharp: isEn ? 'Sharp' : '鋭利', smooth: isEn ? 'Smooth' : 'なめらか', rough: isEn ? 'Rough' : 'ざらざら', coldFeel: isEn ? 'Cold feel' : '冷たい感触', brittle: isEn ? 'Brittle' : 'もろい・割れやすい' },
    size: { tiny: isEn ? '~1mm' : '〜1mm', medium: isEn ? '1-3mm' : '1〜3mm', mm3to5: isEn ? '3-5mm' : '3〜5mm', large: isEn ? '5-10mm' : '5〜10mm', mm10plus: isEn ? '10mm+' : '10mm以上', finePowder: isEn ? 'Fine powder' : '微粉末', longFiber: isEn ? 'Long fiber' : '長い繊維', thinFilm: isEn ? 'Thin film' : '薄いフィルム', thickPiece: isEn ? 'Thick piece' : '厚い片' },
    color: { black: isEn ? 'Black' : '黒', brown: isEn ? 'Brown' : '茶', white: isEn ? 'White' : '白', metalColor: isEn ? 'Metal color' : '金属色', green: isEn ? 'Green' : '緑', transparent: isEn ? 'Transparent' : '透明', blue: isEn ? 'Blue' : '青', red: isEn ? 'Red' : '赤', yellow: isEn ? 'Yellow' : '黄', gray: isEn ? 'Gray' : '灰', silver: isEn ? 'Silver' : '銀' },
    smell: { noSmell: isEn ? 'No smell' : '無臭', burnedSmell: isEn ? 'Burned' : '焦げ臭', oilSmell: isEn ? 'Oil' : '油臭', metalSmell: isEn ? 'Metal' : '金属臭', rubberSmell: isEn ? 'Rubber' : 'ゴム臭', plasticSmell: isEn ? 'Plastic' : 'プラスチック臭', chemicalSmell: isEn ? 'Chemical' : '化学臭', sourSmell: isEn ? 'Sour' : '酸っぱい臭い' },
    magnetTest: { sticks: isEn ? 'Magnetic (sticks)' : '磁石に引き付けられる', noStick: isEn ? 'Non-magnetic' : '磁石につかない', partialStick: isEn ? 'Partially magnetic' : '一部磁石につく' },
    state: { heated: isEn ? 'Heated/cooked' : '加熱済み', raw: isEn ? 'Raw' : '生', embedded: isEn ? 'Embedded' : '埋まっている', attached: isEn ? 'Attached to surface' : '表面付着', wet: isEn ? 'Wet' : '湿っている', dry: isEn ? 'Dry' : '乾燥' },
  }

  const parts: string[] = []
  for (const [group, labels] of Object.entries(labelMap)) {
    if (groupNone[group] || groupUnknown[group]) continue
    const groupData = features[group] as Record<string, boolean> | undefined
    if (!groupData) continue
    const checked = Object.entries(labels)
      .filter(([k]) => groupData[k])
      .map(([, v]) => v)
    if (checked.length > 0) parts.push(checked.join(', '))
  }
  return parts.join(' / ')
}

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
  // ヒント項目（ForeignMatterHints）から「該当」項目を文字列化
  const hintsObj = (inc.hints ?? {}) as Record<string, string>
  const hintsYes = Object.entries(hintsObj).filter(([, v]) => v === 'yes').map(([k]) => k).join(', ')
  const featuresSummary = buildFeaturesSummary(inc, lang)

  const catStr = String(est?.category ?? '')
  const nameStr = String(est?.name ?? '')
  const isInsectExternal = /外部侵入|イエバエ|ニクバエ|蚊|ユスリカ|ガガンボ|ガ類|アザミウマ|ヨコバイ/.test(catStr + nameStr)
  const isInsectInternal = /内部発生|チョウバエ|オオチョウバエ|ショウジョウバエ|ノミバエ|キノコバエ/.test(catStr + nameStr)
  const insectHintJa = isInsectExternal
    ? '・外部侵入性の飛翔昆虫です。原因は開口部・出入り口・窓・換気口など外部と連絡する隙間からの侵入を優先的に検討してください。'
    : isInsectInternal
    ? '・内部発生性の飛翔昆虫（排水路系チョウバエ等）です。原因は排水溝・側溝・床排水口の有機物蓄積・スカム（バイオフィルム）を優先的に検討してください。開口部からの侵入は副次的な可能性です。'
    : ''
  const insectHintEn = isInsectExternal
    ? '- This is an externally-invading flying insect. Prioritize entry points: doors, windows, vents, gaps in walls/screens.'
    : isInsectInternal
    ? '- This is an internally-breeding flying insect (drain fly type). Prioritize organic buildup in floor drains, gutters, scum in drainage channels as the breeding source.'
    : ''

  if (isEn) {
    const productHint = buildProductHintEn(productName)
    return `You are a food safety expert. Analyze the following foreign matter incident and generate root cause hypotheses and corrective actions.

IMPORTANT RULES:
- The AI image analysis result is the highest-priority evidence. Use it as the primary basis for your hypothesis.
- If the "Suspicion/Hint" field has content, treat it as the most important clue.
- Do NOT suggest contamination routes that contradict the foreign matter type (e.g., no metal pathway for plant matter).
- Write hypotheses consistent with the foreign matter type identified by AI.
${insectHintEn}
${productHint}

Incident Data:
- Product: ${productName || '-'}
- Lot: ${inc.lotNumber ?? '-'}
- Discovery Process: ${inc.discoveryProcess ?? '-'}
- Top Estimation (PRIMARY): ${estLabelEn}
- Suspicion / Situation Notes: ${hint || '(none)'}
- Observed Features (characteristics): ${featuresSummary || '(none)'}
- Observed Features (hints): ${hintsYes || '(none)'}
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
(effectiveness verification plan AFTER ③ corrective actions are implemented: what to confirm to prove non-recurrence, timing/frequency, responsible person, acceptance criteria e.g. "0 incidents of same type for 3 months")
[/VERIFY]`
  }

  const productHint = buildProductHintJa(productName)
  return `あなたは食品安全の専門家です。以下の異物混入事故データをもとに、原因仮説と是正処置を生成してください。

【重要ルール】
- AI画像解析結果を最優先の根拠として使用してください。
- 「異物の心当たり」欄に入力がある場合は、それを最も重要な手がかりとして扱ってください。
- 異物の種別と矛盾する混入経路は書かないでください（例: 植物片なのに金属設備の欠損を原因とするなど）。
- AI画像解析が示す異物種別に整合する仮説を立てること。
${insectHintJa}
${productHint}

事故データ:
- 製品名: ${productName || '-'}
- ロット番号: ${inc.lotNumber ?? '-'}
- 発見工程: ${inc.discoveryProcess ?? '-'}
- 第1候補推定（最優先）: ${estLabel}
- 異物の心当たり・状況コメント: ${hint || '（なし）'}
- 観察した特徴（チェックリスト）: ${featuresSummary || '（なし）'}
- 現場の観察結果（ヒント）: ${hintsYes || '（なし）'}
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
（③是正処置の実施後に再発していないことを確認する計画：確認内容・時期・頻度・担当者・判定基準（例：同種異物の発生0件が3か月続くこと））
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
  if (/おにぎり|ご飯|米|弁当|ライス|おこわ|炊飯|白米|玄米/.test(name)) {
    hints.push('・米・ご飯系製品です。白色・半透明・硬い小粒状の異物は炊飯不良米・乾燥米粒・おこげ・籾殻（もみがら）の可能性を優先的に検討してください。')
  }
  if (/ハンバーグ|グラタン|焼き菓子|クッキー|スコーン|マフィン|ケーキ|パン|ピザ|キッシュ|ラザニア|ロースト|天板|オーブン|焼成/.test(name)) {
    hints.push('・オーブン・天板を使用する焼成製品です。白色・半透明・薄いシート状の異物が発見された場合は、クッキングシート（オーブンシート・シリコン加工紙）またはパラフィン紙の切れ端の混入を最優先で検討してください。骨片・金属片と誤判定しないよう注意が必要です。')
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
  if (/rice|onigiri|bento|cooked rice/.test(name)) {
    hints.push('- Rice/cooked-rice product. For white/translucent/hard small particles, prioritize: poorly-cooked rice grains, dried rice kernels, burnt rice (okoge), or unhulled rice (momigara).')
  }
  if (/hamburg|hamburger|gratin|baked|cookie|scone|muffin|cake|bread|pizza|quiche|lasagna|roast|oven|bake/.test(name)) {
    hints.push('- This is an oven-baked product using a baking sheet or tray. For white/translucent/thin sheet-like foreign matter, FIRST consider: cooking sheet (silicone-coated oven paper) fragment, paraffin paper, or parchment paper. Do not misidentify as bone or metal.')
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
    const isEn = lang === 'en'

    // 確定事例を取得（非同期・失敗しても続行）
    type ConfirmedCase = { product_name: string; confirmed_name: string; confirmed_category: string; ai_match: string }
    let confirmedCases: ConfirmedCase[] = []
    try {
      const productName = String(incident.productName ?? '')
      const topCategory = (Array.isArray(incident.estimations) && incident.estimations[0])
        ? String(incident.estimations[0].category ?? '')
        : ''
      confirmedCases = await findSimilarCases(productName, topCategory, 5)
    } catch { /* ignore */ }

    // 確定事例をプロンプトに追記
    let confirmedCasesContext = ''
    if (confirmedCases.length > 0) {
      const caseLines = confirmedCases.map(c =>
        isEn
          ? `  - Product: ${c.product_name || '(unspecified)'}, Confirmed: ${c.confirmed_name}, Category: ${c.confirmed_category}, AI match: ${c.ai_match}`
          : `  ・製品: ${c.product_name || '(不明)'}, 確定異物: ${c.confirmed_name}, カテゴリ: ${c.confirmed_category}, AI一致: ${c.ai_match}`
      ).join('\n')
      confirmedCasesContext = isEn
        ? `\n\nPast confirmed cases (for reference — prioritize if features match):\n${caseLines}`
        : `\n\n過去の確定事例（参考 — 特徴が一致する場合は優先度高）：\n${caseLines}`
    }

    const prompt = buildPrompt(incident, lang) + confirmedCasesContext
    const systemPrompt = lang === 'en'
      ? 'You are a food safety expert. Respond only in the specified format. Always align hypotheses with the identified foreign matter type.'
      : 'あなたは食品安全の専門家です。指定された形式のみで回答してください。異物種別に整合した仮説を立てること。'

    // 最大2回試行（失敗したら自動リトライ）
    let parsed: { cause: string; corrective: string; preventive: string; verify: string } | null = null
    let lastRaw = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await Promise.race([
          callAI({ system: systemPrompt, userText: prompt, maxTokens: 6000 }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000)),
        ])
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

    return NextResponse.json({
      ...parsed,
      ...(confirmedCases.length > 0 ? { confirmedCasesUsed: confirmedCases.length } : {}),
    })
  } catch (err) {
    console.error('[POST /api/ai-cause]', err)
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
  }
}
