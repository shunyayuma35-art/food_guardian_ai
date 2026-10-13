import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import type { Incident } from './types'
import { DISCOVERY_PROCESS_LABELS, calcRecallLevel } from './types'

function today(): string {
  return new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' })
}

function nowStr(): string {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function fmtDatetime(raw: string | undefined): string {
  if (!raw) return '不明'
  try {
    return new Date(raw).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    })
  } catch { return raw }
}

function fmtDate(raw: string | undefined): string {
  if (!raw) return '不明'
  if (!raw.includes('T')) {
    const [y, m, d] = raw.split('-')
    if (y && m && d) return `${y}/${m}/${d}`
    return raw
  }
  try {
    return new Date(raw).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
  } catch { return raw }
}

function getCorrective(incident: Incident): string {
  return incident.editedCorrective || incident.aiCorrectiveRaw || incident.correctiveAction || '（未入力）'
}

function getPreventive(incident: Incident): string {
  return incident.editedPreventive || incident.aiPreventiveRaw || incident.preventiveMeasure || '（未入力）'
}

function getVerification(incident: Incident): string {
  return incident.editedVerification || incident.editedVerify || incident.aiVerifyRaw || '（未入力）'
}

function getStatusLabel(incident: Incident): string {
  if (incident.pdcaStatus === 'done') return '対応完了'
  const map: Record<string, string> = { open: '未対応', investigating: '調査中', closed: '解決済み' }
  return map[incident.status] ?? incident.status
}

function buildConfirmedDocx(incident: Incident): Paragraph[] {
  if (!incident.confirmedName) return []
  const AI_MATCH_LABELS: Record<string, string> = { match: '一致', partial: '部分一致', mismatch: '不一致' }
  return [
    divider(),
    heading('3.5. 確定した異物（正解登録）'),
    labelValue('確定した異物名：', incident.confirmedName),
    ...(incident.confirmedCategory ? [labelValue('確定カテゴリ：', incident.confirmedCategory)] : []),
    ...(incident.confirmedMethod ? [labelValue('確定の方法：', incident.confirmedMethod)] : []),
    ...(incident.aiMatch ? [labelValue('AI第1候補との一致：', AI_MATCH_LABELS[incident.aiMatch] ?? incident.aiMatch)] : []),
    ...(incident.confirmedBy ? [labelValue('確定者：', incident.confirmedBy)] : []),
    ...(incident.confirmedAt ? [labelValue('確定日時：', new Date(incident.confirmedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))] : []),
    ...(incident.confirmedNote ? [labelValue('メモ：', incident.confirmedNote)] : []),
  ]
}

function divider(): Paragraph {
  return new Paragraph({ thematicBreak: true })
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2 })
}

function body(text: string): Paragraph {
  return new Paragraph({ text, spacing: { after: 60 } })
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun(value || '－'),
    ],
    spacing: { after: 60 },
  })
}

function bold(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 60 },
  })
}

function multiLine(text: string): Paragraph[] {
  return text.split('\n').map((line) => body(line))
}

const RECALL_Q_LABELS_DOCX: Record<string, string> = {
  q1_hazardous: '危険物に当たるか',
  q2_sharpHard: '硬い・鋭利な形状か',
  q3_healthClaim: '健康被害の申し出があるか',
  q4_multipleInLot: '同ロット複数件か',
  q5_processOrigin: '製造工程由来の可能性があるか',
  q6_inMarket: '市場に流通しているか',
}
const RECALL_ANS_DOCX: Record<string, string> = { yes: 'はい', no: 'いいえ', unknown: '不明' }
const RECALL_LEVEL_DOCX: Record<string, string> = {
  recall: '🔴 回収の検討が必要',
  consult: '🟡 保健所への相談を推奨',
  internal: '🟢 社内対応で可の可能性',
}

function buildRecallDocx(incident: Incident): Paragraph[] {
  const ra = incident.recallAssessment
  if (!ra) return [body('（回収要否の回答なし）')]
  const lines = Object.entries(RECALL_Q_LABELS_DOCX).map(([k, label]) => {
    const ans = ra[k as keyof typeof ra]
    return body(`${label}：${ans ? RECALL_ANS_DOCX[ans] ?? '－' : '未回答'}`)
  })
  const allAnswered = Object.values(ra).every(v => v !== null)
  const level = allAnswered ? RECALL_LEVEL_DOCX[calcRecallLevel(ra)] ?? '' : '（未回答あり）'
  return [
    ...lines,
    body(''),
    bold(`【判定】${level}`),
    ...(ra.q6_inMarket === 'yes' ? [body('※自主回収の届出（食品衛生法）の確認を推奨します。')] : []),
    body('※これは判断材料です。最終判断は責任者および保健所に相談してください。'),
  ]
}

function buildCauseAnalysisDocx(incident: Incident): Paragraph[] {
  const aiCause = incident.editedCause || incident.aiCauseRaw
  if (aiCause) return multiLine(aiCause)

  const top = incident.estimations[0]
  const catName = top?.category ?? ''
  const isVegetable = /野菜|植物|草|種|木|葉|茎|殻|もみ|籾|米|穀物|藁|麦|豆/.test(catName)
  const isMetal = /金属|鉄|ステンレス|SUS|鋼|銅|アルミ|ボルト|ナット|刃|針|ワイヤ/.test(catName)
  const process = incident.discoveryProcess

  const processMsg: Record<string, string> = {
    after_packaging: isVegetable ? '包装工程後に発見。原料由来の植物片が残留した可能性がある。' : '包装材（フィルム・パッキン・ラベル等）の混入または包装機器の破損部品の可能性が高い。',
    before_packaging: '製造ライン上の設備部品または前工程からの持ち込みが疑われる。',
    after_heating: '炭化物や加熱による樹脂・ゴム部品の劣化・脱落が疑われる。フライヤー・オーブン等の点検を推奨する。',
    before_heating: '原材料または前処理工程からの混入が疑われる。原料受入検査の強化が必要。',
    raw_material_receipt: '供給者側での混入の可能性が高く、サプライヤーへの対応要請が必要。',
    before_shipment: '製造工程全般の混入経路調査が必要。当該ロットの出荷停止を継続すること。',
  }
  const catMsg = top
    ? (isMetal ? `${catName}の混入：金属探知機の感度確認と設備の金属部品点検を実施すること。`
        : isVegetable ? `${catName}の混入：原料由来の可能性が高く、洗浄・選別工程の強化を推奨する。`
        : `${catName}に関連する設備・資材の点検を実施すること。`)
    : '特徴データ不足のため詳細分析が困難。異物を保管の上、専門機関への依頼を検討すること。'
  const processNote = processMsg[process] ?? '製造工程全般の異物管理見直しが必要。'

  return [
    body(`【工程別分析】${processNote}`),
    body(''),
    body(`【異物種別分析】${catMsg}`),
  ]
}

export async function generateIncidentDocx(incident: Incident): Promise<Blob> {
  const processLabel = DISCOVERY_PROCESS_LABELS[incident.discoveryProcess] ?? incident.discoveryProcess
  const statusLabel = getStatusLabel(incident)
  const topEsts = incident.estimations.slice(0, 3)
  const corrective = getCorrective(incident)
  const preventive = getPreventive(incident)

  const children: Paragraph[] = [
    new Paragraph({
      text: '異物混入クレーム報告書',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `${incident.productName}（ロット：${incident.lotNumber}）における異物混入報告`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    labelValue('報告日：', today()),
    labelValue('報告者：', incident.operator),
    labelValue('ステータス：', statusLabel),
    divider(),

    heading('1. 発生概要'),
    labelValue('発生日時　：', fmtDatetime(incident.discoveryDate)),
    labelValue('発見場所　：', `${incident.factory}（${incident.lineNumber} ライン）`),
    labelValue('発見工程　：', processLabel),
    labelValue('製　品　名：', incident.productName),
    labelValue('ロット番号：', incident.lotNumber),
    labelValue('製　造　日：', fmtDate(incident.manufacturingDate)),
    labelValue('賞味期限　：', fmtDate(incident.expiryDate)),
    labelValue('担　当　者：', incident.operator),
    divider(),

    heading('2. 異物の特徴（現場観察結果）'),
    body('【現場担当者コメント】'),
    body(incident.comment || '（記録なし）'),
    divider(),

    ...buildConfirmedDocx(incident),

    heading('3. AI 一次推定結果（参考）'),
    body('※本推定は FoodEye AI システムによる一次判定です。'),
    body('　確定診断には専門機関による鑑定が必要です。'),
    ...(topEsts.length > 0
      ? topEsts.flatMap((e, i) => [
          bold(`第${i + 1}候補：${e.category}（可能性 ${e.probability}%）`),
          labelValue('　根拠：', e.basis.join('、') || 'なし'),
          labelValue('　緊急度：', e.urgency === 'high' ? '高（即時対応要）' : e.urgency === 'medium' ? '中（早期対応推奨）' : '低'),
        ])
      : [body('推定結果なし（特徴チェック未入力のため推定不可）')]),
    divider(),

    heading('4. 発生原因の分析'),
    ...buildCauseAnalysisDocx(incident),
    divider(),

    heading('5. 回収要否の判断材料'),
    ...buildRecallDocx(incident),
    divider(),

    heading('6. CAPA（修正・是正処置・有効性の検証計画）'),
    bold('【① 修正（今回の製品への処置）】'),
    ...multiLine(corrective),
    body(''),
    bold('【③ 是正処置（再発防止の行動計画）】'),
    ...multiLine(preventive),
    body(''),
    bold('【④ 有効性の検証計画】'),
    ...multiLine(getVerification(incident)),
    body(''),
    body('検証結果：________________（記入日：________　記入者：________________）'),
    divider(),

    heading('7. 初期対応内容'),
    body(`・当該ロット（${incident.lotNumber}）の出荷停止・隔離措置を実施`),
    body('・品質管理部門への即時報告'),
    body('・異物の保管・写真記録の実施'),
    body('・FoodEye システムへの事案登録完了'),
    body('・お客様または社内関係者への一次報告'),
    divider(),

    heading('8. 備考・注意事項'),
    body('・本報告書は FoodEye AI 支援システムにより自動生成されました'),
    body('・上記の内容は事実確認後に適宜修正・補足してください'),
    body('・確定的な異物分析には外部専門機関による鑑定が必要です'),
    body('・本報告書の AI 推定結果は「一次判定・仮説」であり、法的・学術的な確定診断ではありません'),
    divider(),

    new Paragraph({
      children: [new TextRun({ text: `生成日時：${nowStr()}　　システム：FoodEye v1.0 | 食品異物事故管理システム`, size: 18, color: '888888' })],
      alignment: AlignmentType.RIGHT,
    }),
  ]

  const doc = new Document({
    creator: incident.operator,
    title: `異物混入報告書_${incident.productName}_${incident.lotNumber}`,
    description: `FoodEye 異物混入クレーム報告書`,
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}
