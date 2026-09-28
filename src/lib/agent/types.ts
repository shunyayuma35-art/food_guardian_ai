export interface AgentAnalysisResult {
  urgency: 'high' | 'medium' | 'low'
  candidates: { name: string; probability: number; reason?: string }[]
  visualFeatures: string[]
}

export interface AgentInput {
  analysisResult: AgentAnalysisResult
  lang?: string
  userHint?: string
  /** 出荷状況（自主回収判断ツール用） */
  shipmentStatus?: 'not_shipped' | 'shipped_not_distributed' | 'in_market'
}

export interface AgentStep {
  step: number
  tool: string
  inputSummary: string
  resultSummary: string
  durationMs: number
  timestamp: string
}

export interface PartialResult {
  checklist?: string[]
  capaReport?: string
  savedIncidentId?: string
  summary?: string
  approvalReason?: string
  checklistSummary?: string
  /** 自主回収リスク評価の結果テキスト */
  recallAssessment?: string
  /** 取引先向け第一報ドラフト */
  customerReport?: string
}

export interface AgentSessionData {
  provider: 'gemini' | 'anthropic'
  /** Gemini: serialized Content[] */
  contents?: unknown[]
  /** Anthropic: serialized MessageParam[] */
  messages?: unknown[]
  steps: AgentStep[]
  input: AgentInput
  partialResult: PartialResult
  /** HMAC signed token to prevent tampering. Created by server, verified on confirm. */
  _token?: string
}

export interface AgentRunResult {
  status: 'completed' | 'awaiting_approval'
  steps: AgentStep[]
  result: PartialResult
  /** Present when status === 'awaiting_approval' — send back to /api/agent/confirm */
  sessionData?: AgentSessionData
}
