import { formatLocalDate, addLocalDays } from './utils'
import { createEmptyFeatures } from './types'
import type { Incident, InspectionRecord, Report } from './types'

export function buildDemoIncidents(): Incident[] {
  const today = formatLocalDate()
  const features = createEmptyFeatures()

  // アルミニウム片の特徴（3mm×2mm フレーク状）
  features.texture.hard = true
  features.texture.sharp = true     // 破断面に鋭い縁がある
  features.texture.smooth = true    // 表面はなめらか
  features.texture.coldFeel = true  // 金属は熱伝導が高く冷たく感じる
  features.texture.brittle = true   // スクレーパーから剥離した脆い欠片
  features.appearance.metallic = true
  features.appearance.flatPlate = true
  features.appearance.flakeChip = true
  features.appearance.mirrorGloss = true
  features.appearance.bent = true   // 剥離時に変形している場合がある
  features.color.silver = true
  features.color.metalColor = true
  features.smell.noSmell = true
  features.waterTest.sinks = true   // アルミ密度 2.7 g/cm³ > 水
  features.size.medium = true       // 3-5mm 範囲
  features.magnetTest.noStick = true // アルミは非磁性
  features.weight.veryLight = true  // 3mm×2mm 程度の極薄フレークは非常に軽い

  const now = new Date().toISOString()
  const discoveryDay = addLocalDays(today, -1)

  const incident: Incident = {
    id: 'demo-inc-001',
    productName: 'サンプルクッキー 12枚入',
    lotNumber: 'LOT-2410-001',
    manufacturingDate: addLocalDays(today, -5),
    expiryDate: addLocalDays(today, 180),
    lineNumber: '1ライン',
    factory: 'サンプル食品 第1工場',
    operator: '山田 花子',
    discoveryDate: `${discoveryDay}T09:30:00+09:00`,
    discoveryProcess: 'after_packaging',
    photos: ['/demo/aluminum-sample.jpg'],
    microscopePhotos: [],
    comment: '包装後の目視検査でアルミニウム片を発見。約3mm×2mmのフレーク状。光沢があり金属特有の冷たさがある。',
    features,
    estimations: [
      {
        category: 'アルミニウム片',
        probability: 92,
        basis: ['磁石につかない（非磁性）', '銀色・金属光沢', 'フレーク状・中型', '冷たく感じる'],
        urgency: 'high',
        source: 'AI即時判定',
      },
      {
        category: 'ステンレス片（SUS304）',
        probability: 6,
        basis: ['磁石につかない（非磁性）', '金属光沢'],
        urgency: 'high',
      },
    ],
    correctiveAction: '当該ラインを一時停止し、ロット全数を金属探知機で再検査。異常品を隔離。アルミ製スクレーパーの先端に欠損を発見し、即時交換を実施。',
    preventiveMeasure: 'アルミ製スクレーパーをプラスチック製へ切替。清掃前後に器具点検チェックリストを導入（毎日）。清掃手順書を改訂。',
    status: 'investigating',
    createdAt: now,
    updatedAt: now,
    createdBy: 'demo-user',
    occurrenceType: 'internal',
    pdcaStatus: 'doing',
    pdcaDeadline: addLocalDays(today, 7),
    pdcaNotes: '是正処置実施中。スクレーパー切替は今週中に完了予定。再発防止の点検チェックリストを作成中。',
    aiCauseRaw: `【4M根本原因分析 (AI仮説)】\n\n■ Man（人）\n清掃担当者が器具の損傷に気づかず使用を継続した。点検記録が未整備だったことが一因。\n\n■ Machine（機械）\n包装ライン上部のアルミ製スクレーパーが経年劣化・摩耗により先端部が欠損したと推定。\n\n■ Material（材料）\nアルミ素材の器具は長期使用で脆くなる特性がある。代替材質（プラスチック・シリコン）への切替が有効。\n\n■ Method（方法）\n器具点検の頻度・方法が不十分（目視のみ・週1回）。より厳密な点検手順の整備が必要。`,
    aiCorrectiveRaw: '1. 当該ロットの出荷停止と全数金属探知機再検査\n2. 欠損したスクレーパーの即時交換\n3. 同種器具の全数点検と記録',
    aiPreventiveRaw: '1. アルミ製器具をプラスチック・シリコン製に全面切替\n2. 器具点検チェックリストを導入（毎日・清掃前後）\n3. 清掃手順書の改訂と教育訓練の実施',
    aiVerifyRaw: '1. 交換後スクレーパーの状態確認と写真記録\n2. 再検査結果（全数）の記録保存\n3. 1ヶ月後に再発がないことを確認し、PDCAを「完了」へ変更',
    causeVerifiedBy: '山田 花子',
    causeVerifiedAt: now,
  }

  return [incident]
}

export function buildDemoInspections(): InspectionRecord[] {
  const today = formatLocalDate()
  const now = new Date().toISOString()

  const passCheck = (time: string) => ({
    time,
    fePassed: true as boolean | null,
    susPassed: true as boolean | null,
    nonFePassed: true as boolean | null,
    passed: true,
  })

  const rec1: InspectionRecord = {
    id: 'demo-insp-001',
    deviceType: 'metal_detector',
    deviceName: '1号金属探知機',
    lineNumber: '1ライン',
    factory: 'サンプル食品 第1工場',
    sensitivity: { fe: 'φ1.5mm', sus: 'φ2.0mm', nonFe: 'φ2.0mm' },
    productName: 'サンプルクッキー 12枚入',
    lotNumber: 'LOT-2410-001',
    inspectionDate: today,
    inspector: '山田 花子',
    startCheck: passCheck('08:00'),
    endCheck: passCheck('17:00'),
    rejectCount: 0,
    result: 'pass',
    comment: '始業・終業テストピース確認ともに合格。異常品なし。',
    createdBy: 'demo-user',
    createdAt: now,
    updatedAt: now,
  }

  const rec2: InspectionRecord = {
    id: 'demo-insp-002',
    deviceType: 'xray',
    deviceName: 'X線検査機-A',
    lineNumber: '2ライン',
    factory: 'サンプル食品 第1工場',
    sensitivity: { xrayThreshold: 'Fe 1.0mm / SUS 1.5mm / 骨 2.0mm' },
    productName: 'サンプルせんべい 15枚入',
    lotNumber: 'LOT-2410-002',
    inspectionDate: today,
    inspector: '山田 花子',
    startCheck: {
      time: '08:15',
      fePassed: null,
      susPassed: null,
      nonFePassed: null,
      passed: true,
      note: 'X線感度確認 合格',
    },
    endCheck: {
      time: '17:15',
      fePassed: null,
      susPassed: null,
      nonFePassed: null,
      passed: true,
      note: 'X線感度確認 合格',
    },
    rejectCount: 0,
    result: 'pass',
    comment: 'X線感度確認合格。異常品なし。全数検査完了。',
    createdBy: 'demo-user',
    createdAt: now,
    updatedAt: now,
  }

  return [rec1, rec2]
}

export function buildDemoReports(): Report[] {
  const today = formatLocalDate()
  const now = new Date().toISOString()
  const discoveryDay = addLocalDays(today, -1)

  const report: Report = {
    id: 'demo-rep-001',
    type: 'incident',
    sourceId: 'demo-inc-001',
    title: '【初動報告書】アルミニウム片混入事案',
    content: [
      '【異物混入事案 初動報告書】',
      '',
      `■ 発生日時: ${discoveryDay} 09:30`,
      '■ 発見場所: 包装後 目視検査',
      '■ 製品名: サンプルクッキー 12枚入',
      '■ ロット番号: LOT-2410-001',
      '■ 担当者: 山田 花子',
      '',
      '■ 異物の特徴',
      '　種類: アルミニウム片（AI判定 92%）',
      '　サイズ: 約3mm × 2mm',
      '　形状: フレーク状・銀色・金属光沢あり',
      '　磁石反応: なし（非磁性）',
      '',
      '■ 初期対応',
      '　・当該ラインを一時停止',
      '　・ロット全数の金属探知機再検査を実施',
      '　・異常品を隔離',
      '',
      '■ 原因調査',
      '　アルミ製スクレーパーの先端に欠損箇所を発見。',
      '　欠損片と形状・材質が一致。混入経路を特定。',
      '',
      '■ 是正・予防処置',
      '　是正: スクレーパーを即時交換、ロット再検査',
      '　予防: アルミ製器具をプラスチック製へ切替、点検チェックリスト導入',
      '',
      '■ 状態: 調査中（PDCA管理中）',
    ].join('\n'),
    productName: 'サンプルクッキー 12枚入',
    lotNumber: 'LOT-2410-001',
    createdAt: now,
    updatedAt: now,
    createdBy: 'demo-user',
  }

  return [report]
}
