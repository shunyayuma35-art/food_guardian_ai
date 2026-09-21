/**
 * Unified AI provider: Anthropic (default) or Vertex AI Gemini.
 * Switch with AI_PROVIDER=gemini env var.
 *
 * NOTES — Vertex AI / Gemini:
 *   - 必要な IAM ロール: roles/aiplatform.user
 *     (未確認: 正確なロール名は Google Cloud IAM コンソールで要確認)
 *   - "Agent Platform API" が aiplatform.googleapis.com を指す場合は有効済み。
 *     別サービス（Vertex AI Agent Builder 等）の場合は追加で有効化が必要（未確認）。
 *   - asia-northeast1 での Gemini モデル提供状況は未確認。
 *     gcloud ai models list --region=asia-northeast1 で確認可能。
 *
 * LOCAL TEST SETUP:
 *   1. gcloud auth application-default login
 *   2. .env.local に追加:
 *        AI_PROVIDER=gemini
 *        GOOGLE_CLOUD_PROJECT=<your-project-id>
 *        GOOGLE_CLOUD_LOCATION=asia-northeast1   # 未確認: us-central1 は確認済み
 *        GEMINI_MODEL=gemini-2.0-flash-001       # 未確認: モデル名は要確認
 *   3. npm run dev
 *
 * CLOUD RUN SETUP:
 *   - サービスアカウントに roles/aiplatform.user を付与するだけで ADC が自動的に使われる。
 *   - GOOGLE_APPLICATION_CREDENTIALS の設定は不要。
 *   - deploy-cloudrun.ps1 の --set-env-vars に上記 4 変数を追加すること。
 */

import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface AiCallOptions {
  system: string
  userText: string
  images?: { base64: string; mediaType: MediaType }[]
  maxTokens?: number
}

export interface AiCallResult {
  text: string
  provider: 'anthropic' | 'gemini'
  model: string
}

// ---------------------------------------------------------------------------
// Config (all from env vars, no hard-coded secrets)
// ---------------------------------------------------------------------------

const PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as 'anthropic' | 'gemini'
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? ''
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1'
// 未確認: 実際に使用前に `gcloud ai models list --region=<location>` で確認すること。
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001'
const ANTHROPIC_MODEL = 'claude-opus-4-5'

// ---------------------------------------------------------------------------
// Server-side rate limiting (in-memory, per instance)
//
// PURPOSE: Cookie ベースの MAX_MONTHLY=10 はクライアント側で改ざん可能なため、
//          サーバー側でも上限を設ける二重防護。
//
// LIMITATION: Cloud Run の複数インスタンス間でカウンターは共有されない。
//             本番運用では Supabase の api_usage テーブルによる DB 側カウントを推奨:
//               UPDATE api_usage SET count = count + 1
//               WHERE month = current_month AND count < SERVER_LIMIT
//               RETURNING count
// ---------------------------------------------------------------------------

const _serverLog = new Map<string, { month: string; count: number }>()
const SERVER_MONTHLY_LIMIT = 200  // 全ユーザー合計 / インスタンス / 月

function checkAndIncrementServerLimit(): boolean {
  const m = new Date().toISOString().slice(0, 7)
  const entry = _serverLog.get('global')
  if (!entry || entry.month !== m) {
    _serverLog.set('global', { month: m, count: 1 })
    return true
  }
  if (entry.count >= SERVER_MONTHLY_LIMIT) return false
  entry.count++
  return true
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function callAI(opts: AiCallOptions): Promise<AiCallResult> {
  if (!checkAndIncrementServerLimit()) {
    throw new Error('SERVER_LIMIT_EXCEEDED')
  }
  return PROVIDER === 'gemini' ? callGemini(opts) : callAnthropic(opts)
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(opts: AiCallOptions): Promise<AiCallResult> {
  const client = new Anthropic()

  const content: Anthropic.MessageParam['content'] = []
  if (opts.images) {
    for (const img of opts.images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      })
    }
  }
  content.push({ type: 'text', text: opts.userText })

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: 'user', content }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? ''
  return { text, provider: 'anthropic', model: ANTHROPIC_MODEL }
}

// ---------------------------------------------------------------------------
// Vertex AI Gemini (ADC — no API key required)
// SDK: @google-cloud/vertexai
// ADC: Cloud Run サービスアカウント / ローカルは gcloud auth application-default login
// ---------------------------------------------------------------------------

async function callGemini(opts: AiCallOptions): Promise<AiCallResult> {
  if (!GCP_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required when AI_PROVIDER=gemini')
  }

  // Dynamic import: Gemini SDK は Anthropic 使用時にロードしない（コールドスタート最適化）
  const { VertexAI } = await import('@google-cloud/vertexai')

  const vertexai = new VertexAI({ project: GCP_PROJECT, location: GCP_LOCATION })
  const generativeModel = vertexai.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 1024 },
    systemInstruction: { role: 'system', parts: [{ text: opts.system }] },
  })

  // Build parts array (images first, then text)
  type InlinePart = { inlineData: { mimeType: string; data: string } }
  type TextPart = { text: string }
  const parts: (InlinePart | TextPart)[] = []

  if (opts.images) {
    for (const img of opts.images) {
      parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } })
    }
  }
  parts.push({ text: opts.userText })

  const result = await generativeModel.generateContent({
    contents: [{ role: 'user', parts }],
  })

  const text =
    result.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  return { text, provider: 'gemini', model: GEMINI_MODEL }
}
