import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import type { Incident } from './types'
import { DISCOVERY_PROCESS_LABELS } from './types'

function today(): string {
  return new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}

function nowStr(): string {
  return new Date().toLocaleString('ja-JP')
}

function getCorrective(incident: Incident): string {
  return incident.editedCorrective || incident.aiCorrectiveRaw || incident.correctiveAction || '（未入力）'
}

function getPreventive(incident: Incident): string {
  return incident.editedPreventive || incident.aiPreventiveRaw || incident.preventiveMeasure || '（未入力）'
}

function getStatusLabel(incident: Incident): string {
  if (incident.pdcaStatus === 'done') return '対応完了'
  const map: Record<string, string> = { open: '未対応', investigating: '調査中', closed: '解決済み' }
  return map[incident.status] ?? incident.status
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
    labelValue('発生日時　：', incident.discoveryDate),
    labelValue('発見場所　：', `${incident.factory}（${incident.lineNumber} ライン）`),
    labelValue('発見工程　：', processLabel),
    labelValue('製　品　名：', incident.productName),
    labelValue('ロット番号：', incident.lotNumber),
    labelValue('製　造　日：', incident.manufacturingDate || '不明'),
    labelValue('賞味期限　：', incident.expiryDate || '不明'),
    labelValue('担　当　者：', incident.operator),
    divider(),

    heading('2. 異物の特徴（現場観察結果）'),
    body('【現場担当者コメント】'),
    body(incident.comment || '（記録なし）'),
    divider(),

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

    heading('4. 是正処置・再発防止策'),
    bold('【是正処置】'),
    ...multiLine(corrective),
    body(''),
    bold('【再発防止策】'),
    ...multiLine(preventive),
    divider(),

    heading('5. 初期対応内容'),
    body(`・当該ロット（${incident.lotNumber}）の出荷停止・隔離措置を実施`),
    body('・品質管理部門への即時報告'),
    body('・異物の保管・写真記録の実施'),
    body('・FoodEye システムへの事案登録完了'),
    body('・お客様または社内関係者への一次報告'),
    divider(),

    heading('6. 備考・注意事項'),
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
