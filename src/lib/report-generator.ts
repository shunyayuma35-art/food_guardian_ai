import type { Incident, SensoryEvaluation, FeatureChecklist } from './types'
import {
  DISCOVERY_PROCESS_LABELS,
  INCIDENT_STATUS_LABELS,
  SENSORY_JUDGEMENT_LABELS,
  APPEARANCE_EVAL_LABELS,
  SMELL_EVAL_LABELS,
  TASTE_EVAL_LABELS,
  TEXTURE_EVAL_LABELS,
  APPEARANCE_GRADE_LABELS,
} from './types'

function today(): string {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function nowStr(): string {
  return new Date().toLocaleString('ja-JP')
}

function buildFeatureSummary(features: FeatureChecklist): string {
  const lines: string[] = []

  const tx = features.texture
  const txItems = [
    tx.hard && '固い', tx.soft && '柔らかい', tx.elastic && '弾力あり',
    tx.crumbly && '崩れやすい', tx.sticky && '粘着あり',
  ].filter(Boolean)
  if (txItems.length) lines.push(`  触感　　: ${txItems.join('、')}`)

  const ap = features.appearance
  const apItems = [
    ap.fibrous && '繊維状', ap.breakSection && '破断面あり', ap.bent && '曲がり・変形',
    ap.layered && '層構造', ap.granular && '粒状', ap.bubbly && '泡状・気泡',
    ap.glossy && '光沢', ap.matte && 'マット', ap.burned && '焦げ',
    ap.translucent && '半透明', ap.transparent && '透明感',
    ap.metallic && '金属感', ap.scratched && 'キズあり',
    ap.patterned && '模様あり', ap.rubbery && 'ゴム感',
  ].filter(Boolean)
  if (apItems.length) lines.push(`  見た目　: ${apItems.join('、')}`)

  const co = features.color
  const coItems = [
    co.black && '黒', co.brown && '茶・褐色', co.white && '白・乳白',
    co.whiteTurbid && '白濁', co.metalColor && '金属光沢',
    co.transparent && '透明', co.green && '緑',
  ].filter(Boolean)
  if (coItems.length) lines.push(`  色　　　: ${coItems.join('、')}`)

  const sz = features.size
  if (sz) {
    const szItems = [
      sz.tiny && '微小（1mm未満）', sz.finePowder && '微細粉',
      sz.medium && '中型（1〜5mm）', sz.longFiber && '長い繊維（5mm以上）',
      sz.thinFilm && '薄膜状', sz.thickPiece && '厚片・塊',
    ].filter(Boolean)
    if (szItems.length) lines.push(`  サイズ　: ${szItems.join('、')}`)
  }

  const sm = features.smell
  const smItems = [
    sm.burnedSmell && '焦げ臭', sm.oilSmell && '油臭',
    sm.chemicalSmell && '薬品臭', sm.noSmell && '無臭',
  ].filter(Boolean)
  if (smItems.length) lines.push(`  におい　: ${smItems.join('、')}`)

  const wt = features.waterTest
  const wtItems = [
    wt.floats && '水に浮く', wt.sinks && '水に沈む',
    wt.dissolves && '水に溶ける', wt.oilSurface && '油浮き',
  ].filter(Boolean)
  if (wtItems.length) lines.push(`  水試験　: ${wtItems.join('、')}`)

  return lines.length ? lines.join('\n') : '  （特徴データ未入力）'
}

function generateCauseAnalysis(incident: Incident): string {
  const top = incident.estimations[0]
  const process = incident.discoveryProcess

  const processMap: Record<string, string> = {
    after_packaging: '包装工程後に発見。包装材（フィルム・パッキン・ラベル等）の混入、または包装機器の磨耗・破損部品の可能性が高い。',
    before_packaging: '包装前工程での発見。製造ライン上の設備（ベルト・ゴムパッキン・金属部品等）または前工程からの持ち込みが疑われる。',
    after_heating: '加熱工程後の発見。炭化物や加熱による樹脂・ゴム部品の劣化・脱落が疑われる。フライヤー・オーブン・熱板等の点検が推奨される。',
    before_heating: '加熱前の原材料または前処理工程からの混入が疑われる。原料受入検査の強化と前処理工程の異物管理の見直しが必要。',
    raw_material_receipt: '原料受入時点での発見。供給者側での混入の可能性が高く、当該サプライヤーへの速やかな情報提供と対応要請が必要。',
    before_shipment: '出荷前検査での発見。製造工程全般にわたる混入経路の調査が必要。当該ロットの出荷停止を継続し、全数検査または抜取り強化を実施する。',
  }

  const categoryMap: Record<string, string> = {
    '金属片': '製造ライン上の金属部品（刃・スクリュー・ボルト等）の摩耗・欠損が主因。金属探知機の感度確認と当該工程の設備点検を優先実施すること。',
    'ゴムパッキン': '設備のシール材・バルブ・フランジ部の劣化脱落が疑われる。高温・酸・アルカリにさらされる工程での劣化が早く、定期交換サイクルの見直しが有効。',
    '毛髪・繊維': '衛生管理不備が主要因。帽子・マスク・毛髪ネットの着用状況確認と入室前チェック体制の強化が必要。作業着の繊維確認も実施すること。',
    '炭化物': 'フライヤー油の劣化、オーブン内壁の汚れ、ベルトコンベアの焦げ付きが典型的な発生源。清掃頻度見直しと温度管理の精度向上を推奨する。',
    '包材フィルム': '包装機セット時・フィルム交換時に破片が落下するケースが多い。作業前後の目視確認と包装機メンテナンス強化を推奨する。',
    '手袋片': '使い捨て手袋の破損・摩耗による混入が考えられる。手袋の使用前確認と定期交換の徹底、並びに金属検出機（手袋に金属片を含む製品利用）の検討を推奨する。',
    '洗浄スポンジ': '洗浄・清掃工程でのスポンジの破損が原因。スポンジの定期交換（使い捨て化の推進）と、清掃後の残留チェックを徹底すること。',
    '骨片': '原料（肉・魚）に含まれる骨の混入が疑われる。原料受入時の骨除去確認と、金属探知機・X線検査機による検出強化が有効。',
    '虫・昆虫': '原料・製造環境からの混入。防虫対策（ライトトラップ・防虫ネット・ドア管理）の見直しと、原料保管環境の整備が必要。',
    '樹脂片': '製造設備の樹脂部品（ベルト・バケット・スクレーパー等）の劣化・欠損が疑われる。設備点検と樹脂部品の定期交換を実施すること。',
  }

  const processPart = processMap[process] ?? '製造工程全般の異物管理見直しが必要。'
  const catPart = top
    ? (categoryMap[top.category] ?? `${top.category}に関連する設備・資材の点検を実施すること。`)
    : '特徴データが不足しているため、現時点では詳細な分析が困難です。異物を保管の上、専門機関への依頼を検討してください。'

  return top
    ? `AI推定第1候補「${top.category}」（可能性 ${top.probability}%）に基づく分析：

【工程別分析】
${processPart}

【異物種別分析】
${catPart}`
    : `【工程別分析】\n${processPart}\n\n【異物種別分析】\n${catPart}`
}

// ── 異物混入クレーム報告書 ───────────────────────────────────────

export function generateIncidentReport(incident: Incident): string {
  const processLabel = DISCOVERY_PROCESS_LABELS[incident.discoveryProcess]
  const statusLabel = INCIDENT_STATUS_LABELS[incident.status]
  const topEsts = incident.estimations.slice(0, 3)
  const featuresSummary = buildFeatureSummary(incident.features)
  const causeAnalysis = generateCauseAnalysis(incident)

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【異物混入クレーム報告書】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

件　名：${incident.productName}（ロット：${incident.lotNumber}）における異物混入報告

報告日：${today()}
報告者：${incident.operator}
ステータス：${statusLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 発生概要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

発生日時　：${incident.discoveryDate}
発見場所　：${incident.factory}（${incident.lineNumber} ライン）
発見工程　：${processLabel}
製　品　名：${incident.productName}
ロット番号：${incident.lotNumber}
製　造　日：${incident.manufacturingDate || '不明'}
賞 味 期 限：${incident.expiryDate || '不明'}
担　当　者：${incident.operator}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 異物の特徴（現場観察結果）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${featuresSummary}

【現場担当者コメント】
${incident.comment || '（記録なし）'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AI 一次推定結果（参考）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※本推定は FoodEye AI システムによる一次判定です。
  確定診断には専門機関（外部検査機関等）による鑑定が必要です。

${topEsts.length > 0
  ? topEsts.map((e, i) =>
      `  第${i + 1}候補：${e.category}（可能性 ${e.probability}%）\n  　根拠　：${e.basis.join('、') || 'なし'}\n  　緊急度：${e.urgency === 'high' ? '高（即時対応要）' : e.urgency === 'medium' ? '中（早期対応推奨）' : '低'}`
    ).join('\n\n')
  : '  推定結果なし（特徴チェック未入力のため推定不可）'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 発生原因の分析（現時点）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${causeAnalysis}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. 初期対応内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

・当該ロット（${incident.lotNumber}）の出荷停止・隔離措置を実施
・品質管理部門への即時報告
・異物の保管・写真記録の実施
・FoodEye システムへの事案登録完了
・お客様または社内関係者への一次報告

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. 是正処置・再発防止策
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【是正処置】
${incident.correctiveAction || '（未入力）'}

【再発防止策】
${incident.preventiveMeasure || '（未入力）'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. 備考・注意事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

・本報告書は FoodEye AI 支援システムにより自動生成されました
・上記の内容は事実確認後に適宜修正・補足してください
・確定的な異物分析には外部専門機関による鑑定が必要です
・本報告書の AI 推定結果は「一次判定・仮説」であり、
  法的・学術的な確定診断ではありません

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                            以上
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

生成日時：${nowStr()}
システム：FoodEye v1.0 | 食品異物事故管理・特定支援システム
`
}

// ── 官能検査報告書 ───────────────────────────────────────────────

export function generateSensoryReport(evaluation: SensoryEvaluation): string {
  const judgementLabel = SENSORY_JUDGEMENT_LABELS[evaluation.judgement]
  const judgementEmoji = evaluation.judgement === 'pass' ? '✅' : evaluation.judgement === 'warning' ? '⚠️' : '❌'

  // 詳細スコアのテキスト化
  const detailSection = (() => {
    const parts: string[] = []
    if (evaluation.tasteScore) {
      const ts = evaluation.tasteScore
      parts.push(`【味覚スコア（1=弱い〜5=強い）】
  甘味：${'★'.repeat(ts.sweet)}${'☆'.repeat(5-ts.sweet)} (${ts.sweet}/5)　酸味：${'★'.repeat(ts.sour)}${'☆'.repeat(5-ts.sour)} (${ts.sour}/5)
  塩味：${'★'.repeat(ts.salty)}${'☆'.repeat(5-ts.salty)} (${ts.salty}/5)　苦味：${'★'.repeat(ts.bitter)}${'☆'.repeat(5-ts.bitter)} (${ts.bitter}/5)
  うま味：${'★'.repeat(ts.umami)}${'☆'.repeat(5-ts.umami)} (${ts.umami}/5)`)
    }
    if (evaluation.scentEval) {
      const sc = evaluation.scentEval
      parts.push(`【香り評価】
  状態：${sc.status === 'normal' ? '正常' : '異臭あり'}${sc.status === 'abnormal' ? `　強度：${sc.intensity}/5` : ''}`)
    }
    if (evaluation.appearanceGrade) {
      parts.push(`【外観グレード】
  判定：${APPEARANCE_GRADE_LABELS[evaluation.appearanceGrade]}`)
    }
    if (evaluation.textureScore) {
      const tx = evaluation.textureScore
      parts.push(`【触感・食感スコア（1=弱い〜5=強い）】
  硬さ：${tx.hardness}/5　粘り：${tx.stickiness}/5　口どけ：${tx.mouthfeel}/5　歯ごたえ：${tx.chewiness}/5`)
    }
    if (evaluation.soundEval) {
      parts.push(`【音（聴覚）評価】
  パリッと音：${evaluation.soundEval.crunchy ? 'あり' : 'なし'}${evaluation.soundEval.comment ? `　備考：${evaluation.soundEval.comment}` : ''}`)
    }
    return parts.length > 0 ? '\n' + parts.join('\n') : ''
  })()

  const approvalStatus = evaluation.approvedAt
    ? `承認済み（承認者：${evaluation.approvedBy}　承認日時：${new Date(evaluation.approvedAt).toLocaleString('ja-JP')}）`
    : '未承認（最終承認者による確認待ち）'

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【官能検査報告書】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

件　名：${evaluation.productName}（ロット：${evaluation.lotNumber}）官能検査結果報告

報告日：${today()}
検査者：${evaluation.inspectorName}
承認者：${evaluation.approverName || '（未設定）'}
承認状況：${approvalStatus}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 検査概要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

製　品　名：${evaluation.productName}
ロット番号：${evaluation.lotNumber}
検査日時　：${new Date(evaluation.date).toLocaleString('ja-JP')}
検 査 担 当：${evaluation.inspectorName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 官能評価結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【総合サマリー】
  外観　：${APPEARANCE_EVAL_LABELS[evaluation.appearance]}${evaluation.appearanceGrade ? `（グレード：${APPEARANCE_GRADE_LABELS[evaluation.appearanceGrade]}）` : ''}
  におい：${SMELL_EVAL_LABELS[evaluation.smell]}${evaluation.scentEval?.status === 'abnormal' ? `（強度：${evaluation.scentEval.intensity}/5）` : ''}
  味　　：${TASTE_EVAL_LABELS[evaluation.taste]}
  食感　：${TEXTURE_EVAL_LABELS[evaluation.texture]}
${detailSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. 総合判定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

　　判定結果：${judgementEmoji} ${judgementLabel}

判定方法：
${evaluation.judgementMethod.length > 0
  ? evaluation.judgementMethod.map((m) => `  ・${m}`).join('\n')
  : '  （未選択）'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 検査コメント・特記事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${evaluation.comment || '（特記事項なし）'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. 判定に基づく対応
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${evaluation.judgement === 'pass'
  ? '本ロットは官能検査の基準を満たしています。\n通常の出荷・流通工程を継続してください。'
  : evaluation.judgement === 'warning'
  ? '本ロットに注意を要する事項が確認されました。\n最終承認者による確認を行い、追加検査または条件付き出荷の判断を実施してください。\n当該ロットの管理強化（温度・保管条件等）を推奨します。'
  : '本ロットは官能検査の基準を満たしていません。\n出荷停止・隔離措置を実施し、原因究明および廃棄・再処理の判断を行ってください。\n品質管理部門への即時報告が必要です。'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. 備考・注意事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

・本報告書は FoodEye 官能検査システムにより自動生成されました
・官能検査結果は主観的評価を含む場合があり、客観的分析の補完として活用してください
・最終判断は最終承認者の確認・署名をもって確定となります

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                            以上
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

生成日時：${nowStr()}
システム：FoodEye v1.0 | 食品品質管理・官能検査支援システム
`
}

// ── CSV エクスポート用 ────────────────────────────────────────────

export function incidentToCSV(incident: Incident): string {
  const top = incident.estimations[0]
  const rows = [
    ['項目', '内容'],
    ['製品名', incident.productName],
    ['ロット番号', incident.lotNumber],
    ['製造日', incident.manufacturingDate],
    ['賞味期限', incident.expiryDate],
    ['工場', incident.factory],
    ['ライン', incident.lineNumber],
    ['担当者', incident.operator],
    ['発見日', incident.discoveryDate],
    ['発見工程', DISCOVERY_PROCESS_LABELS[incident.discoveryProcess]],
    ['ステータス', INCIDENT_STATUS_LABELS[incident.status]],
    ['AI推定第1位', top ? `${top.category}（${top.probability}%）` : '（なし）'],
    ['是正処置', incident.correctiveAction],
    ['再発防止策', incident.preventiveMeasure],
    ['コメント', incident.comment],
    ['登録日時', incident.createdAt],
  ]
  return '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function sensoryToCSV(ev: SensoryEvaluation): string {
  const rows = [
    ['項目', '内容'],
    ['製品名', ev.productName],
    ['ロット番号', ev.lotNumber],
    ['検査日時', ev.date],
    ['検査者', ev.inspectorName],
    ['承認者', ev.approverName],
    ['外観', APPEARANCE_EVAL_LABELS[ev.appearance]],
    ['におい', SMELL_EVAL_LABELS[ev.smell]],
    ['味', TASTE_EVAL_LABELS[ev.taste]],
    ['食感', TEXTURE_EVAL_LABELS[ev.texture]],
    ['判定', SENSORY_JUDGEMENT_LABELS[ev.judgement]],
    ['判定方法', ev.judgementMethod.join('・')],
    ['コメント', ev.comment],
    ['承認日時', ev.approvedAt ?? '未承認'],
    ['承認者名', ev.approvedBy ?? ''],
    ['登録日時', ev.createdAt],
  ]
  return '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

// ── Word (.doc HTML) エクスポート用 ──────────────────────────────

export function reportToWordHTML(title: string, content: string): string {
  const htmlContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(/━+/g, '<hr style="border:1px solid #ccc"/>')

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: "MS Mincho","Yu Mincho",serif; font-size:11pt; line-height:1.8; margin:2cm; }
    h1 { font-size:16pt; text-align:center; margin-bottom:1em; }
    p { margin:0.3em 0; }
    hr { border:1px solid #aaa; margin:0.5em 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${htmlContent}</p>
</body>
</html>`
}
