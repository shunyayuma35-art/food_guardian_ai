/**
 * 異物対応エージェントのメインループ。
 * Cloud Run (Gemini Function Calling) とローカル (Anthropic tool_use) の両方に対応。
 * タイムアウト: 85 秒（Cloud Run 上限 120 秒の余裕を持たせた値）
 */

import {
  executeTool,
  TOOL_DECLARATIONS_GEMINI,
  TOOL_DECLARATIONS_ANTHROPIC,
} from './tools'
import type { AgentInput, AgentRunResult, AgentSessionData, AgentStep, PartialResult } from './types'
import type { FunctionCallingConfigMode } from '@google/genai'

const PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as 'anthropic' | 'gemini'
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? ''
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const AGENT_TIMEOUT_MS = 85_000
const MAX_STEPS = 8

function buildSystemPrompt(input: AgentInput, approved: boolean, approvedBy?: string): string {
  const urgencyLabel =
    input.analysisResult.urgency === 'high'
      ? '最高/高'
      : input.analysisResult.urgency === 'medium'
        ? '中'
        : '低'
  const candidates = input.analysisResult.candidates
    .map((c) => `${c.name}(${Math.round(c.probability * 100)}%)`)
    .join(', ')
  const hint = input.userHint ? `\n補足情報: ${input.userHint}` : ''
  const approvalNote = approved
    ? `\n承認済み（承認者: ${approvedBy ?? '不明'}）。CAPA報告書作成 → 事故記録保存 の順に進めてください。`
    : ''

  return `あなたは食品製造工場の異物対応エージェントです。
以下の解析結果に基づいて対応を進めてください。

【解析結果】
緊急度: ${urgencyLabel}
異物候補: ${candidates}
特徴: ${input.analysisResult.visualFeatures.join(', ')}${hint}${approvalNote}

【対応フロー】
1. get_knowledge で異物カテゴリの知識を確認する
2. search_similar_incidents で類似事例を検索する
3. create_action_checklist で対応チェックリストを生成する
4. submit_for_approval でチェックリストを提出し承認を求める（高/最高緊急度の場合は必須）
5. （承認後）draft_capa_report で CAPA 報告書を作成する
6. save_incident で事故記録を Firestore に保存する

すべての操作をツールを使って実行してください。テキストのみの回答は最終まとめのみにしてください。`
}

// ── Gemini ループ ─────────────────────────────────────────────────

async function runGeminiLoop(
  input: AgentInput,
  initialContents: unknown[],
  initialSteps: AgentStep[],
  initialPartialResult: PartialResult,
  approved: boolean,
  approvedBy?: string,
): Promise<AgentRunResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION })

  const systemPrompt = buildSystemPrompt(input, approved, approvedBy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = initialContents.length
    ? [...initialContents]
    : [
        {
          role: 'user',
          parts: [
            {
              text: `異物対応を開始してください。緊急度: ${input.analysisResult.urgency}、異物候補: ${input.analysisResult.candidates.map((c) => c.name).join(', ')}`,
            },
          ],
        },
      ]

  const steps: AgentStep[] = [...initialSteps]
  const partialResult: PartialResult = { ...initialPartialResult }
  const ctx = { partialResult }

  for (let i = 0; i < MAX_STEPS; i++) {
    const t0 = Date.now()
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ functionDeclarations: TOOL_DECLARATIONS_GEMINI as any }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' as FunctionCallingConfigMode } },
        systemInstruction: systemPrompt,
        maxOutputTokens: 2000,
      },
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fcPart = responseParts.find((p: any) => p.functionCall)
    const textPart = responseParts.find((p: any) => p.text)?.text ?? ''

    if (!fcPart?.functionCall) {
      // ツール呼び出しなし → 完了
      partialResult.summary = textPart
      return { status: 'completed', steps, result: partialResult }
    }

    const { name = '', args = {} } = fcPart.functionCall
    contents.push({ role: 'model', parts: responseParts })

    const toolResult = await executeTool(name, args as Record<string, string>, ctx)

    steps.push({
      step: steps.length + 1,
      tool: name,
      inputSummary: JSON.stringify(args).slice(0, 120),
      resultSummary: toolResult.output.slice(0, 200),
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
    })

    if (toolResult.triggerApproval) {
      // 承認待ち：会話状態を保存してクライアントに返す
      const sessionData: AgentSessionData = {
        provider: 'gemini',
        contents,
        steps,
        input,
        partialResult,
      }
      return {
        status: 'awaiting_approval',
        steps,
        result: partialResult,
        sessionData,
      }
    }

    // ツール結果を会話に追加
    contents.push({
      role: 'user',
      parts: [{ functionResponse: { name, response: { output: toolResult.output } } }],
    })
  }

  partialResult.summary = 'エージェントが最大ステップ数に達しました。'
  return { status: 'completed', steps, result: partialResult }
}

// ── Anthropic ループ ──────────────────────────────────────────────

async function runAnthropicLoop(
  input: AgentInput,
  initialMessages: unknown[],
  initialSteps: AgentStep[],
  initialPartialResult: PartialResult,
  approved: boolean,
  approvedBy?: string,
): Promise<AgentRunResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  const systemPrompt = buildSystemPrompt(input, approved, approvedBy)

  type Msg = { role: 'user' | 'assistant'; content: unknown }
  const messages: Msg[] = initialMessages.length
    ? [...(initialMessages as Msg[])]
    : [
        {
          role: 'user',
          content: `異物対応を開始してください。緊急度: ${input.analysisResult.urgency}、異物候補: ${input.analysisResult.candidates.map((c) => c.name).join(', ')}`,
        },
      ]

  const steps: AgentStep[] = [...initialSteps]
  const partialResult: PartialResult = { ...initialPartialResult }
  const ctx = { partialResult }

  for (let i = 0; i < MAX_STEPS; i++) {
    const t0 = Date.now()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      tools: TOOL_DECLARATIONS_ANTHROPIC,
      messages: messages as Parameters<typeof client.messages.create>[0]['messages'],
    })

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text')
      partialResult.summary =
        textBlock && textBlock.type === 'text' ? textBlock.text : ''
      return { status: 'completed', steps, result: partialResult }
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
    const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = []
    let triggerApproval = false

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue
      const toolResult = await executeTool(
        block.name,
        block.input as Record<string, string>,
        ctx,
      )
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: toolResult.output,
      })
      steps.push({
        step: steps.length + 1,
        tool: block.name,
        inputSummary: JSON.stringify(block.input).slice(0, 120),
        resultSummary: toolResult.output.slice(0, 200),
        durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      })
      if (toolResult.triggerApproval) triggerApproval = true
    }

    if (triggerApproval) {
      messages.push({ role: 'user', content: toolResults })
      const sessionData: AgentSessionData = {
        provider: 'anthropic',
        messages,
        steps,
        input,
        partialResult,
      }
      return { status: 'awaiting_approval', steps, result: partialResult, sessionData }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  partialResult.summary = 'エージェントが最大ステップ数に達しました。'
  return { status: 'completed', steps, result: partialResult }
}

// ── パブリック API ─────────────────────────────────────────────────

/**
 * エージェントを実行する。
 * - sessionData がある場合は承認後の再開（approved=true 前提）。
 * - sessionData がない場合は新規実行。
 */
export async function runAgent(
  input: AgentInput,
  sessionData?: AgentSessionData,
  approved?: boolean,
  approvedBy?: string,
): Promise<AgentRunResult> {
  const provider = sessionData?.provider ?? PROVIDER

  const loop =
    provider === 'gemini'
      ? runGeminiLoop(
          input,
          sessionData?.contents ?? [],
          sessionData?.steps ?? [],
          sessionData?.partialResult ?? {},
          approved ?? false,
          approvedBy,
        )
      : runAnthropicLoop(
          input,
          sessionData?.messages ?? [],
          sessionData?.steps ?? [],
          sessionData?.partialResult ?? {},
          approved ?? false,
          approvedBy,
        )

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AGENT_TIMEOUT')), AGENT_TIMEOUT_MS),
  )

  return Promise.race([loop, timeout])
}
