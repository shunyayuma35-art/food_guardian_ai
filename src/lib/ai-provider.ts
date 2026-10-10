/**
 * Unified AI provider: Anthropic (default) or Vertex AI Gemini.
 * Switch with AI_PROVIDER=gemini env var.
 *
 * SDK: @google/genai v2.23.0 (公式推奨。@google-cloud/vertexai は 2026/06/24 以降
 *      Gemini 機能を削除予定の非推奨 SDK のため、こちらを使用)
 *
 * ── Vertex AI 利用時の IAM 権限 ──────────────────────────────────────────
 * サービスアカウント: 670414377052-compute@developer.gserviceaccount.com
 * 必要なロール: roles/aiplatform.user
 *   （未確認: 2026/04 に Vertex AI → Gemini Enterprise Agent Platform に改名。
 *    ロール ID は変わっていない可能性が高いが、Google Cloud Console の IAM 画面で
 *    "aiplatform.user" を検索して確認すること）
 * 付与コマンド（実行は本人が行うこと）:
 *   gcloud projects add-iam-policy-binding <project-id> \
 *     --member="serviceAccount:670414377052-compute@developer.gserviceaccount.com" \
 *     --role="roles/aiplatform.user"
 *
 * ── ローカルテスト手順 ───────────────────────────────────────────────────
 * 1. gcloud auth application-default login
 *    （ブラウザが開く。Google アカウントでログイン後、ADC が ~/.config/gcloud/ に保存される）
 * 2. .env.local に追加:
 *      AI_PROVIDER=gemini
 *      GOOGLE_CLOUD_PROJECT=project-66aee540-552a-4a95-b80
 *      GOOGLE_CLOUD_LOCATION=asia-northeast1
 *      GEMINI_MODEL=gemini-2.5-flash
 *    ※ GEMINI_API_KEY は不要（ADC を使うため）
 * 3. npm run dev
 *
 * ── Cloud Run での動作 ───────────────────────────────────────────────────
 * サービスアカウントに roles/aiplatform.user を付与すれば ADC が自動的に使われる。
 * GOOGLE_APPLICATION_CREDENTIALS の設定は不要。
 * deploy-cloudrun.ps1 の --set-env-vars に以下を追加すること:
 *   AI_PROVIDER=gemini
 *   GOOGLE_CLOUD_PROJECT=project-66aee540-552a-4a95-b80
 *   GOOGLE_CLOUD_LOCATION=asia-northeast1
 *   GEMINI_MODEL=gemini-2.5-flash
 *
 * ── 利用可能モデル（Vertex AI 確認済み）─────────────────────────────────
 * - gemini-2.5-flash     : 推奨。高速・マルチモーダル対応
 * - gemini-2.0-flash-001 : 安定版
 * - gemini-2.0-flash     : 最新の 2.0 系
 * ※ asia-northeast1 での提供状況: 標準 API 呼び出しは動作するが、
 *   Provisioned Throughput は Single Zone のみサポート（2026/09 時点）。
 *   モデル詳細は Cloud Console → Vertex AI → Model Garden で確認すること。
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
  /** Gemini 向け: JSON のみ返させる (responseMimeType: "application/json") */
  jsonMode?: boolean
  /** 多ターン会話の過去履歴（最新メッセージは userText に渡す） */
  history?: { role: 'user' | 'assistant'; text: string }[]
}

export interface AiCallResult {
  text: string
  provider: 'anthropic' | 'gemini'
  model: string
}

// ---------------------------------------------------------------------------
// Config (env vars のみ。ハードコードなし)
// ---------------------------------------------------------------------------

const PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as 'anthropic' | 'gemini'
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? ''
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Server-side rate limiting (in-memory)
//
// 目的: Cookie ベース制限（MAX_MONTHLY=10）はクライアント側で改ざん可能なため、
//       サーバー側でも月次上限を設ける二重防護。
//
// 限界: インスタンスごとにカウンターを保持。インスタンス再起動・スケールアウト時に
//       リセットされる。複数インスタンス間では共有されない。
//       本番運用では Supabase の api_usage テーブルによる DB カウントを推奨:
//         UPDATE api_usage SET count = count + 1
//         WHERE month = current_month AND count < SERVER_LIMIT
//         RETURNING count
// ---------------------------------------------------------------------------

const _serverLog = new Map<string, { month: string; count: number }>()
const SERVER_MONTHLY_LIMIT = 200

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
  const result = await (PROVIDER === 'gemini' ? callGemini(opts) : callAnthropic(opts))
  console.log('[ai-provider] provider=%s model=%s', result.provider, result.model)
  return result
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(opts: AiCallOptions): Promise<AiCallResult> {
  const client = new Anthropic()

  const msgs: Anthropic.MessageParam[] = []

  // 過去履歴を追加
  if (opts.history) {
    for (const h of opts.history) {
      msgs.push({ role: h.role, content: h.text })
    }
  }

  // 現在のユーザーメッセージ（画像＋テキスト）
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
  msgs.push({ role: 'user', content })

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: msgs,
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? ''
  return { text, provider: 'anthropic', model: ANTHROPIC_MODEL }
}

// ---------------------------------------------------------------------------
// Vertex AI Gemini (ADC — API キー不要)
// SDK: @google/genai  https://www.npmjs.com/package/@google/genai
// ---------------------------------------------------------------------------

async function callGemini(opts: AiCallOptions): Promise<AiCallResult> {
  if (!GCP_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required when AI_PROVIDER=gemini')
  }

  // Dynamic import: Anthropic 使用時に Gemini SDK をロードしない（コールドスタート最適化）
  const { GoogleGenAI } = await import('@google/genai')

  const ai = new GoogleGenAI({
    vertexai: true,
    project: GCP_PROJECT,
    location: GCP_LOCATION,
  })

  type Part = { text: string } | { inlineData: { mimeType: string; data: string } }
  type GeminiContent = { role: 'user' | 'model'; parts: Part[] }

  const contents: GeminiContent[] = []

  // 過去履歴を追加
  if (opts.history) {
    for (const h of opts.history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }],
      })
    }
  }

  // 現在のユーザーメッセージ（画像を先に、テキストを後に）
  const currentParts: Part[] = []
  if (opts.images) {
    for (const img of opts.images) {
      currentParts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } })
    }
  }
  currentParts.push({ text: opts.userText })
  contents.push({ role: 'user', parts: currentParts })

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 1024,
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  })

  // response.text はショートハンドだが null を返す場合があるため手動抽出でフォールバック
  const text =
    response.text
    ?? response.candidates?.[0]?.content?.parts?.[0]?.text
    ?? ''
  return { text, provider: 'gemini', model: GEMINI_MODEL }
}
