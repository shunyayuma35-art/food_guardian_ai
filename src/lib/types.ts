export type OccurrenceType = 'internal' | 'external'
export const OCCURRENCE_TYPE_LABELS: Record<OccurrenceType, string> = {
  internal: '社内発見',
  external: '外部クレーム',
}

export type ClaimRoute =
  | 'consumer_to_store'
  | 'consumer_direct'
  | 'distributor'
  | 'business_partner'
  | 'other'
export const CLAIM_ROUTE_LABELS: Record<ClaimRoute, string> = {
  consumer_to_store: '消費者→小売店',
  consumer_direct: '消費者直接',
  distributor: '流通業者',
  business_partner: '取引先企業',
  other: 'その他',
}

export type DiscoveryProcess =
  | 'raw_material_receipt'
  | 'before_heating'
  | 'after_heating'
  | 'before_packaging'
  | 'after_packaging'
  | 'before_shipment'

export const DISCOVERY_PROCESS_LABELS: Record<DiscoveryProcess, string> = {
  raw_material_receipt: '原料受入',
  before_heating: '加熱前',
  after_heating: '加熱後',
  before_packaging: '包装前',
  after_packaging: '包装後',
  before_shipment: '出荷前',
}

// ── 異物特徴チェック ────────────────────────────────────────────

export interface TextureFeatures {
  hard: boolean       // 固い
  soft: boolean       // 柔らかい
  elastic: boolean    // 弾力あり
  crumbly: boolean    // 崩れやすい
  sticky: boolean     // 粘着あり
}

export interface AppearanceFeatures {
  glossy: boolean       // 光沢
  matte: boolean        // マット
  translucent: boolean  // 半透明
  transparent: boolean  // 透明感
  burned: boolean       // 焦げ
  fibrous: boolean      // 繊維状
  breakSection: boolean // 破断面あり
  bent: boolean         // 曲がり・変形
  granular: boolean     // 粒状
  layered: boolean      // 層構造
  bubbly: boolean       // 泡状・気泡
  metallic: boolean     // 金属感
  scratched: boolean    // キズあり
  patterned: boolean    // 模様あり
  rubbery: boolean      // ゴム感
}

export interface ColorFeatures {
  black: boolean       // 黒
  brown: boolean       // 茶・褐色
  white: boolean       // 白・乳白
  whiteTurbid: boolean // 白濁
  metalColor: boolean  // 金属光沢
  transparent: boolean // 透明
  green: boolean       // 緑
}

export interface SmellFeatures {
  burnedSmell: boolean   // 焦げ臭
  oilSmell: boolean      // 油臭
  chemicalSmell: boolean // 薬品臭
  noSmell: boolean       // 無臭
}

export interface WaterTestFeatures {
  floats: boolean    // 浮く
  sinks: boolean     // 沈む
  dissolves: boolean // 溶ける
  oilSurface: boolean // 油浮き
}

export interface SizeFeatures {
  finePowder: boolean // 微細粉
  longFiber: boolean  // 長い繊維（5mm以上）
  thinFilm: boolean   // 薄膜・フィルム状
  thickPiece: boolean // 厚片・塊状
  tiny: boolean       // 微小（1mm未満）
  medium: boolean     // 中型（1〜5mm）
}

export interface FeatureChecklist {
  texture: TextureFeatures
  appearance: AppearanceFeatures
  color: ColorFeatures
  smell: SmellFeatures
  waterTest: WaterTestFeatures
  size: SizeFeatures
}

export interface EstimationResult {
  category: string
  probability: number
  basis: string[]
  urgency: 'high' | 'medium' | 'low'
  source?: string
}

export type IncidentStatus = 'open' | 'investigating' | 'closed'

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: '対応中',
  investigating: '調査中',
  closed: '完了',
}

export interface Incident {
  id: string
  productName: string
  lotNumber: string
  manufacturingDate: string
  expiryDate: string
  lineNumber: string
  factory: string
  operator: string
  discoveryDate: string
  discoveryProcess: DiscoveryProcess
  photos: string[]
  microscopePhotos: string[]
  comment: string
  features: FeatureChecklist
  estimations: EstimationResult[]
  correctiveAction: string
  preventiveMeasure: string
  status: IncidentStatus
  createdAt: string
  updatedAt: string
  createdBy: string
  // 外部クレーム拡張フィールド（後方互換: 既存レコードはすべてundefined）
  occurrenceType?: OccurrenceType
  claimSource?: string
  claimDate?: string
  claimContent?: string
  claimPhotos?: string[]
  claimRoute?: ClaimRoute
  // 是正処置PDCA
  pdcaStatus?: PdcaStatus
  pdcaDeadline?: string
  pdcaNotes?: string
}

export type PdcaStatus = 'planned' | 'doing' | 'checking' | 'done'
export const PDCA_STATUS_LABELS: Record<PdcaStatus, string> = {
  planned: '📋 計画中',
  doing: '🔧 実施中',
  checking: '🔍 確認中',
  done: '✅ 完了',
}
export const PDCA_STATUS_COLORS: Record<PdcaStatus, string> = {
  planned: 'bg-blue-100 text-blue-700 border-blue-200',
  doing: 'bg-amber-100 text-amber-700 border-amber-200',
  checking: 'bg-purple-100 text-purple-700 border-purple-200',
  done: 'bg-green-100 text-green-700 border-green-200',
}

export function createEmptyFeatures(): FeatureChecklist {
  return {
    texture: { hard: false, soft: false, elastic: false, crumbly: false, sticky: false },
    appearance: {
      glossy: false,
      matte: false,
      translucent: false,
      transparent: false,
      burned: false,
      fibrous: false,
      breakSection: false,
      bent: false,
      granular: false,
      layered: false,
      bubbly: false,
      metallic: false,
      scratched: false,
      patterned: false,
      rubbery: false,
    },
    color: {
      black: false,
      brown: false,
      white: false,
      whiteTurbid: false,
      metalColor: false,
      transparent: false,
      green: false,
    },
    smell: { burnedSmell: false, oilSmell: false, chemicalSmell: false, noSmell: false },
    waterTest: { floats: false, sinks: false, dissolves: false, oilSurface: false },
    size: {
      finePowder: false,
      longFiber: false,
      thinFilm: false,
      thickPiece: false,
      tiny: false,
      medium: false,
    },
  }
}

export function hasAnyFeature(features: FeatureChecklist): boolean {
  return (
    Object.values(features.texture).some(Boolean) ||
    Object.values(features.appearance).some(Boolean) ||
    Object.values(features.color).some(Boolean) ||
    Object.values(features.smell).some(Boolean) ||
    Object.values(features.waterTest).some(Boolean) ||
    Object.values(features.size ?? {}).some(Boolean)
  )
}

// ── 官能検査（詳細評価） ─────────────────────────────────────────

/** 味覚 5項目 × 5段階評価 (1=とても弱い 〜 5=とても強い) */
export interface TasteScore {
  sweet: number   // 甘味
  sour: number    // 酸味
  salty: number   // 塩味
  bitter: number  // 苦味
  umami: number   // うま味
}

/** 香り評価 */
export interface ScentEval {
  status: 'normal' | 'abnormal'
  intensity: number  // 1〜5（abnormal時に意味を持つ）
}

/** 色・外観グレード */
export type AppearanceGrade = 'good' | 'limit' | 'defective'
export const APPEARANCE_GRADE_LABELS: Record<AppearanceGrade, string> = {
  good: '良品',
  limit: '限度見本',
  defective: '出荷一時停止',
}

/** 触感スコア (1=弱い 〜 5=強い) */
export interface TextureScore {
  hardness: number   // 硬さ
  stickiness: number // 粘り
  mouthfeel: number  // 口どけ（1=溶けにくい 〜 5=なめらか）
  chewiness: number  // 歯ごたえ（1=ない 〜 5=強い）
}

/** 音評価 */
export interface SoundEval {
  crunchy: boolean  // パリッと音あり
  comment: string
}

// ── 官能検査（サマリー型） ───────────────────────────────────────

export type SensoryJudgement = 'pass' | 'warning' | 'fail'
export type AppearanceEval = 'normal' | 'discolored' | 'foreign_material' | 'other'
export type SmellEval = 'normal' | 'abnormal'
export type TasteEval = 'normal' | 'bitter' | 'salty' | 'off_flavor' | 'other'
export type TextureEval = 'normal' | 'hard' | 'sticky' | 'other'

export const SENSORY_JUDGEMENT_LABELS: Record<SensoryJudgement, string> = {
  pass: '合格',
  warning: '要注意',  // 後方互換のため残す（UI非表示）
  fail: '出荷停止',
}

export const APPEARANCE_EVAL_LABELS: Record<AppearanceEval, string> = {
  normal: '正常',
  discolored: '変色あり',
  foreign_material: '異物あり',
  other: 'その他',
}

export const SMELL_EVAL_LABELS: Record<SmellEval, string> = {
  normal: '正常',
  abnormal: '異臭あり',
}

export const TASTE_EVAL_LABELS: Record<TasteEval, string> = {
  normal: '正常',
  bitter: '苦味',
  salty: '塩辛い',
  off_flavor: '異味',
  other: 'その他',
}

export const TEXTURE_EVAL_LABELS: Record<TextureEval, string> = {
  normal: '正常',
  hard: '硬い',
  sticky: '粘つく',
  other: 'その他',
}

export const JUDGEMENT_METHOD_OPTIONS = [
  '外観基準',
  'におい基準',
  '味覚基準',
  '食感基準',
  '製品規格書に基づく',
  '自社官能基準に基づく',
  'AI推定結果を参考',
  'その他',
]

// ── 金属検出器・X線検査記録 ──────────────────────────────────────

export type DeviceType = 'metal_detector' | 'xray'
export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  metal_detector: '金属探知機',
  xray: 'X線検査機',
}

export type InspectionResult = 'pass' | 'fail' | 'adjusted'
export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  pass: '正常',
  fail: '異常',
  adjusted: '調整後OK',
}

export interface TestPieceCheck {
  time: string           // HH:MM
  fePassed: boolean | null    // Fe（鉄）
  susPassed: boolean | null   // SUS（ステンレス）
  nonFePassed: boolean | null // Non-Fe（非鉄金属）
  passed: boolean        // 全体合否
  note?: string
}

export interface InspectionRecord {
  id: string

  // 機器情報
  deviceType: DeviceType
  deviceName: string     // 例: "1号金属探知機" "X線-A"
  lineNumber: string     // 例: "1ライン"
  factory?: string

  // 感度設定
  sensitivity: {
    fe?: string          // 例: "φ1.5mm"
    sus?: string         // 例: "φ2.0mm"
    nonFe?: string       // 例: "φ2.0mm"
    xrayThreshold?: string // 例: "Fe 1.0mm / SUS 1.5mm / 骨 2.0mm"
  }

  // 製品情報
  productName: string
  lotNumber: string

  // 検査情報
  inspectionDate: string // YYYY-MM-DD
  inspector: string

  // テストピース始業確認
  startCheck: TestPieceCheck

  // テストピース終業確認
  endCheck: TestPieceCheck

  // 異常排除記録
  rejectCount: number
  rejectDetails?: string  // 排除品の内容

  // 結果・対応
  result: InspectionResult
  correctionAction?: string

  comment?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── 報告書 ──────────────────────────────────────────────────────

export type ReportType = 'incident' | 'sensory'

export interface Report {
  id: string
  type: ReportType
  sourceId: string
  title: string
  content: string
  productName: string
  lotNumber: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ── 官能検査 ────────────────────────────────────────────────────

export interface SensoryEvaluation {
  id: string
  productName: string
  lotNumber: string
  date: string
  inspectorName: string
  approverName: string
  // サマリー（後方互換・AI判定用）
  appearance: AppearanceEval
  smell: SmellEval
  taste: TasteEval
  texture: TextureEval
  // 詳細評価スコア（任意）
  tasteScore?: TasteScore
  scentEval?: ScentEval
  appearanceGrade?: AppearanceGrade
  textureScore?: TextureScore
  soundEval?: SoundEval
  limitSamplePhoto?: string   // 限度見本比較写真（base64 data URL）
  comment: string
  judgement: SensoryJudgement
  judgementMethod: string[]
  images: string[]
  linkedIncidentIds: string[]
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}
