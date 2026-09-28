export interface AgentAnalysisResult {
  urgency: 'high' | 'medium' | 'low'
  candidates: { name: string; probability: number; reason?: string }[]
  visualFeatures: string[]
}

export interface AgentInput {
  analysisResult: AgentAnalysisResult
  lang?: string
  userHint?: string
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
}

export interface AgentRunResult {
  status: 'completed' | 'awaiting_approval'
  steps: AgentStep[]
  result: PartialResult
  /** Present when status === 'awaiting_approval' — send back to /api/agent/confirm */
  sessionData?: AgentSessionData
}
