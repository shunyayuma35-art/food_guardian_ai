import { FOREIGN_MATTER_DB } from '../foreign-matter-db'
import { listIncidents, createIncident } from '../firestore'
import { createEmptyFeatures } from '../types'
import type { PartialResult } from './types'

// ── 内部 AI ヘルパー（rate limit カウンター外） ────────────────────

async function callAIText(system: string, userText: string): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? 'anthropic'
  const maxTokens = 1500

  if (provider === 'gemini') {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT ?? '',
      location: process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1',
    })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      config: { systemInstruction: system, maxOutputTokens: maxTokens },
    })
    return (
      response.text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      ''
    )
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }],
  })
  const block = res.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

// ── ツール実装 ─────────────────────────────────────────────────────

/** 異物データベースから該当カテゴリのセクションを返す */
function getKnowledge(category: string): string {
  const lower = category.toLowerCase()
  const lines = FOREIGN_MATTER_DB.split('\n')
  const sections: string[] = []
  let inSection = false
  let buf: string[] = []

  const keywords: Record<string, string[]> = {
    虫: ['虫類', '害虫', '昆虫'],
    金属: ['金属類'],
    プラスチック: ['プラスチック', '樹脂'],
    魚: ['魚類', '甲殻類'],
    骨: ['肉類', '骨類'],
    釣り: ['釣り', '漁業'],
    貝: ['貝類'],
    ガラス: ['ガラス', '陶器'],
    農薬: ['農薬', '化学'],
    カビ: ['カビ', '微生物'],
    繊維: ['繊維'],
    砂: ['砂', '土', '無機物'],
    作業用品: ['作業用品', '設備'],
    包装: ['包装', '梱包'],
    水: ['水', '氷由来'],
    植物: ['植物', '食品由来'],
    原料: ['原料由来'],
  }

  // カテゴリに対応するセクションヘッダーを探す
  const matchHeaders: string[] = []
  for (const [key, headers] of Object.entries(keywords)) {
    if (lower.includes(key) || headers.some((h) => lower.includes(h.toLowerCase()))) {
      matchHeaders.push(...headers)
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inSection && buf.length) {
        sections.push(buf.join('\n'))
        buf = []
      }
      const header = line.replace('### ', '')
      inSection = matchHeaders.some((h) => header.includes(h))
      if (inSection) buf.push(line)
    } else if (inSection) {
      buf.push(line)
    }
  }
  if (inSection && buf.length) sections.push(buf.join('\n'))

  if (sections.length === 0) {
    // フォールバック：緊急度基準 + 全文先頭300文字
    const urgency = FOREIGN_MATTER_DB.split('## 緊急度基準')[1] ?? ''
    return `【カテゴリ "${category}" の専用情報なし】\n\n## 緊急度基準\n${urgency.trim()}`
  }
  return sections.join('\n\n')
}

/** 過去の異物事故をキーワードで検索（Firestore） */
async function searchSimilarIncidents(keyword: string): Promise<string> {
  try {
    const incidents = await listIncidents()
    const lower = keyword.toLowerCase()
    const matched = incidents.filter((inc) => {
      const text = [
        inc.productName,
        inc.comment,
        inc.correctiveAction,
        inc.preventiveMeasure,
        ...(inc.estimations?.map((e) => e.category) ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return text.includes(lower)
    })
    if (matched.length === 0) return `「${keyword}」に一致する過去事例は見つかりませんでした。`
    const summary = matched
      .slice(0, 5)
      .map(
        (inc, i) =>
          `${i + 1}. [${inc.status}] ${inc.productName} — ${inc.comment.slice(0, 80)}`,
      )
      .join('\n')
    return `「${keyword}」の過去事例 ${matched.length} 件（上位5件）:\n${summary}`
  } catch (err) {
    return `過去事例の検索中にエラーが発生しました: ${String(err)}`
  }
}

/** AI で対応チェックリストを生成 */
async function createActionChecklist(
  foreignMatter: string,
  urgency: string,
): Promise<{ checklist: string[]; text: string }> {
  const system =
    '食品異物対応の専門家として、簡潔で実践的な対応チェックリストを生成してください。箇条書きで5〜8項目。日本語で回答。'
  const userText = `異物: ${foreignMatter}\n緊急度: ${urgency}\n\n対応チェックリストを生成してください。各項目を「・」で始めてください。`
  const text = await callAIText(system, userText)
  const checklist = text
    .split('\n')
    .map((l) => l.replace(/^[・\-\*]\s*/, '').trim())
    .filter((l) => l.length > 5)
  return { checklist, text }
}

/** AI で CAPA報告書ドラフトを生成 */
async function draftCapaReport(
  foreignMatter: string,
  urgency: string,
  incidentSummary: string,
  approvedBy: string,
): Promise<string> {
  const system =
    '食品安全の専門家として、是正処置（CA）と予防処置（PA）を含む CAPA 報告書ドラフトを生成してください。日本語で簡潔に。'
  const userText = `
異物: ${foreignMatter}
緊急度: ${urgency}
事案概要: ${incidentSummary}
承認者: ${approvedBy}

CAPA 報告書ドラフトを以下の構成で作成してください:
1. 事案概要
2. 根本原因推定
3. 是正処置（CA）
4. 予防処置（PA）
5. 効果確認方法
`.trim()
  return callAIText(system, userText)
}

/** Firestore に異物事故を保存 */
async function saveIncident(
  productName: string,
  lotNumber: string,
  description: string,
  location: string,
  urgency: string,
): Promise<string> {
  const urgencyMap: Record<string, 'high' | 'medium' | 'low'> = {
    high: 'high', 高: 'high', 最高: 'high',
    medium: 'medium', 中: 'medium',
    low: 'low', 低: 'low',
  }
  const mappedUrgency = urgencyMap[urgency] ?? 'medium'

  const id = await createIncident({
    productName: productName || 'エージェント記録',
    lotNumber: lotNumber || '',
    manufacturingDate: '',
    expiryDate: '',
    lineNumber: location || '',
    factory: '',
    operator: '',
    discoveryDate: new Date().toISOString().slice(0, 10),
    discoveryProcess: 'after_packaging',
    photos: [],
    microscopePhotos: [],
    comment: description,
    features: createEmptyFeatures(),
    estimations: [
      {
        category: foreignMatter(description),
        probability: 0.8,
        basis: ['エージェント解析'],
        urgency: mappedUrgency,
        source: 'agent',
      },
    ],
    correctiveAction: '',
    preventiveMeasure: '',
    status: 'open',
    createdBy: 'agent',
  })
  return id
}

function foreignMatter(description: string): string {
  const m = description.match(/異物[:：]?\s*([^\n。、]{2,20})/)
  return m ? m[1] : description.slice(0, 20)
}

// ── ツールルーター ─────────────────────────────────────────────────

export interface ToolContext {
  partialResult: PartialResult
  approvedBy?: string
}

export interface ToolResult {
  output: string
  /** submit_for_approval の場合 true */
  triggerApproval?: boolean
  approvalReason?: string
  checklistSummary?: string
}

export async function executeTool(
  name: string,
  args: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case 'get_knowledge': {
      const output = getKnowledge(args.category ?? '')
      return { output }
    }

    case 'search_similar_incidents': {
      const output = await searchSimilarIncidents(args.keyword ?? '')
      return { output }
    }

    case 'create_action_checklist': {
      const { checklist, text } = await createActionChecklist(
        args.foreign_matter ?? '',
        args.urgency ?? 'medium',
      )
      ctx.partialResult.checklist = checklist
      return { output: text }
    }

    case 'submit_for_approval': {
      const reason = args.reason ?? ''
      const checklistSummary = args.checklist_summary ?? ''
      ctx.partialResult.approvalReason = reason
      ctx.partialResult.checklistSummary = checklistSummary
      return {
        output: `承認申請を送信しました。理由: ${reason}`,
        triggerApproval: true,
        approvalReason: reason,
        checklistSummary,
      }
    }

    case 'draft_capa_report': {
      const report = await draftCapaReport(
        args.foreign_matter ?? '',
        args.urgency ?? 'medium',
        args.incident_summary ?? '',
        ctx.approvedBy ?? '未設定',
      )
      ctx.partialResult.capaReport = report
      return { output: report }
    }

    case 'save_incident': {
      const id = await saveIncident(
        args.product_name ?? '',
        args.lot_number ?? '',
        args.description ?? '',
        args.location ?? '',
        args.urgency ?? 'medium',
      )
      ctx.partialResult.savedIncidentId = id
      return { output: `異物事故を Firestore に保存しました。ID: ${id}` }
    }

    default:
      return { output: `不明なツール: ${name}` }
  }
}

// ── Gemini / Anthropic 用ツール宣言 ───────────────────────────────

export const TOOL_DECLARATIONS_GEMINI = [
  {
    name: 'get_knowledge',
    description: '食品異物データベースから指定カテゴリの知識を取得する',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: '異物カテゴリ（例: 金属、虫類、魚骨）' },
      },
      required: ['category'],
    },
  },
  {
    name: 'search_similar_incidents',
    description: '過去の異物事故記録からキーワードで類似事例を検索する',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: { type: 'STRING', description: '検索キーワード（異物名・製品名など）' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'create_action_checklist',
    description: '異物の種類と緊急度に応じた対応チェックリストを生成する',
    parameters: {
      type: 'OBJECT',
      properties: {
        foreign_matter: { type: 'STRING', description: '異物の種類・名称' },
        urgency: { type: 'STRING', description: '緊急度（high/medium/low）' },
      },
      required: ['foreign_matter', 'urgency'],
    },
  },
  {
    name: 'submit_for_approval',
    description: 'チェックリストを担当者に提出し、承認を求める（ここでエージェントは一時停止）',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: '承認が必要な理由の説明' },
        checklist_summary: { type: 'STRING', description: 'チェックリストの要約（100文字以内）' },
      },
      required: ['reason', 'checklist_summary'],
    },
  },
  {
    name: 'draft_capa_report',
    description: '承認後、是正処置・予防処置（CAPA）報告書のドラフトを作成する',
    parameters: {
      type: 'OBJECT',
      properties: {
        foreign_matter: { type: 'STRING', description: '異物の種類・名称' },
        urgency: { type: 'STRING', description: '緊急度' },
        incident_summary: { type: 'STRING', description: '事案の概要（100文字以内）' },
      },
      required: ['foreign_matter', 'urgency', 'incident_summary'],
    },
  },
  {
    name: 'save_incident',
    description: '異物事故記録を Firestore に保存する',
    parameters: {
      type: 'OBJECT',
      properties: {
        product_name: { type: 'STRING', description: '製品名' },
        lot_number: { type: 'STRING', description: 'ロット番号（不明の場合は空文字）' },
        description: { type: 'STRING', description: '事案の詳細説明' },
        location: { type: 'STRING', description: '発見場所・ライン番号' },
        urgency: { type: 'STRING', description: '緊急度（high/medium/low）' },
      },
      required: ['product_name', 'description', 'urgency'],
    },
  },
]

export const TOOL_DECLARATIONS_ANTHROPIC = [
  {
    name: 'get_knowledge',
    description: '食品異物データベースから指定カテゴリの知識を取得する',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: '異物カテゴリ（例: 金属、虫類、魚骨）' },
      },
      required: ['category'],
    },
  },
  {
    name: 'search_similar_incidents',
    description: '過去の異物事故記録からキーワードで類似事例を検索する',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: '検索キーワード（異物名・製品名など）' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'create_action_checklist',
    description: '異物の種類と緊急度に応じた対応チェックリストを生成する',
    input_schema: {
      type: 'object' as const,
      properties: {
        foreign_matter: { type: 'string', description: '異物の種類・名称' },
        urgency: { type: 'string', description: '緊急度（high/medium/low）' },
      },
      required: ['foreign_matter', 'urgency'],
    },
  },
  {
    name: 'submit_for_approval',
    description: 'チェックリストを担当者に提出し、承認を求める（ここでエージェントは一時停止）',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: '承認が必要な理由の説明' },
        checklist_summary: { type: 'string', description: 'チェックリストの要約（100文字以内）' },
      },
      required: ['reason', 'checklist_summary'],
    },
  },
  {
    name: 'draft_capa_report',
    description: '承認後、是正処置・予防処置（CAPA）報告書のドラフトを作成する',
    input_schema: {
      type: 'object' as const,
      properties: {
        foreign_matter: { type: 'string', description: '異物の種類・名称' },
        urgency: { type: 'string', description: '緊急度' },
        incident_summary: { type: 'string', description: '事案の概要（100文字以内）' },
      },
      required: ['foreign_matter', 'urgency', 'incident_summary'],
    },
  },
  {
    name: 'save_incident',
    description: '異物事故記録を Firestore に保存する',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_name: { type: 'string', description: '製品名' },
        lot_number: { type: 'string', description: 'ロット番号（不明の場合は空文字）' },
        description: { type: 'string', description: '事案の詳細説明' },
        location: { type: 'string', description: '発見場所・ライン番号' },
        urgency: { type: 'string', description: '緊急度（high/medium/low）' },
      },
      required: ['product_name', 'description', 'urgency'],
    },
  },
]
