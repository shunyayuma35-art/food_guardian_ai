import { FOREIGN_MATTER_DB } from '../foreign-matter-db'
import type { PartialResult } from './types'

// ── 内部 AI ヘルパー ──────────────────────────────────────────────

async function callAIText(
  system: string,
  userText: string,
  maxTokens = 1500,
): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? 'anthropic'

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
    const urgency = FOREIGN_MATTER_DB.split('## 緊急度基準')[1] ?? ''
    return `【カテゴリ "${category}" の専用情報なし】\n\n## 緊急度基準\n${urgency.trim()}`
  }
  return sections.join('\n\n')
}

/** Supabase の incidents テーブルからキーワードで過去事例を検索 */
async function searchSimilarIncidents(keyword: string, lang: string): Promise<string> {
  try {
    const { getSupabaseAdmin } = await import('../supabase')
    const db = getSupabaseAdmin()

    // SQL インジェクション対策: 特殊文字をエスケープ
    const safeKeyword = keyword.replace(/[%_\\]/g, (c) => `\\${c}`).slice(0, 100)

    const { data, error } = await db
      .from('incidents')
      .select('id, title, location, description, status, created_at')
      .or(`title.ilike.%${safeKeyword}%,description.ilike.%${safeKeyword}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw new Error(error.message)

    if (!data?.length) {
      return lang === 'en'
        ? `No similar incidents found for "${keyword}".`
        : `「${keyword}」に一致する過去事例は見つかりませんでした。`
    }

    const header = lang === 'en'
      ? `Found ${data.length} similar incident(s) for "${keyword}":\n`
      : `「${keyword}」の過去事例 ${data.length} 件:\n`

    const rows = data
      .map((inc, i) => `${i + 1}. [${inc.status}] ${inc.title} — ${(inc.description ?? '').slice(0, 80)}`)
      .join('\n')

    return header + rows
  } catch (err) {
    return lang === 'en'
      ? `Error searching incidents: ${String(err)}`
      : `過去事例の検索中にエラーが発生しました: ${String(err)}`
  }
}

/** AI で対応チェックリストを生成 */
async function createActionChecklist(
  foreignMatter: string,
  urgency: string,
  lang: string,
): Promise<{ checklist: string[]; text: string }> {
  const isEn = lang === 'en'

  const system = isEn
    ? 'You are a food safety specialist. Generate a concise, practical action checklist (5-8 items). Respond in English only.'
    : '食品異物対応の専門家として、簡潔で実践的な対応チェックリストを生成してください。箇条書きで5〜8項目。日本語で回答。'

  const userText = isEn
    ? `Foreign matter: ${foreignMatter}\nUrgency: ${urgency}\n\nGenerate an action checklist. Start each item with "- ".`
    : `異物: ${foreignMatter}\n緊急度: ${urgency}\n\n対応チェックリストを生成してください。各項目を「・」で始めてください。`

  const text = await callAIText(system, userText)
  const checklist = text
    .split('\n')
    .map((l) => l.replace(/^[・\-\*\d\.]\s*/, '').trim())
    .filter((l) => l.length > 5)

  return { checklist, text }
}

/** AI で CAPA 報告書ドラフトを生成 */
async function draftCapaReport(
  foreignMatter: string,
  urgency: string,
  incidentSummary: string,
  approvedBy: string,
  lang: string,
): Promise<string> {
  const isEn = lang === 'en'

  const system = isEn
    ? 'You are a food safety specialist. Create a concise CAPA (Corrective and Preventive Action) report draft including CA and PA sections. Respond in English only.'
    : '食品安全の専門家として、是正処置（CA）と予防処置（PA）を含む CAPA 報告書ドラフトを生成してください。日本語で簡潔に。'

  const userText = isEn
    ? `
Foreign matter: ${foreignMatter}
Urgency: ${urgency}
Incident summary: ${incidentSummary}
Approved by: ${approvedBy}

Please write a CAPA report draft with these sections:
1. Incident Summary
2. Root Cause Analysis
3. Corrective Action (CA)
4. Preventive Action (PA)
5. Effectiveness Check Method
`.trim()
    : `
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

/** 自主回収リスクを評価し、判断材料を提示する（AI は最終判断しない） */
async function assessRecallRisk(
  matterType: string,
  urgency: string,
  shipmentStatus: string,
  lang: string,
): Promise<string> {
  const isEn = lang === 'en'

  const statusLabel: Record<string, { ja: string; en: string }> = {
    not_shipped: { ja: '未出荷（製造ライン内）', en: 'Not yet shipped (in-line)' },
    shipped_not_distributed: { ja: '出荷済み（市場未流通）', en: 'Shipped, not yet in market' },
    in_market: { ja: '市場流通中', en: 'Already in market circulation' },
  }
  const statusText = statusLabel[shipmentStatus]
    ? (isEn ? statusLabel[shipmentStatus].en : statusLabel[shipmentStatus].ja)
    : shipmentStatus

  const system = isEn
    ? `You are a food safety compliance advisor. Provide recall risk assessment as decision-SUPPORT material only. Always state: "This is NOT a final determination. Consult your supervisor and the local health authority before taking any action." Do not make final recall decisions. Do NOT determine a specific recall class (Class I/II/III) — state that the classification must be determined in consultation with the health authority. Respond in English only. Use Markdown formatting (headers, bold, bullet lists, tables) for readability.`
    : `あなたは食品安全コンプライアンスのアドバイザーです。自主回収の判断材料を提示しますが、最終判断は行いません。必ず「これは最終判断ではありません。必ず責任者および保健所に相談してください」と記載してください。回収クラス（CLASS I/II/III）の断定はしないこと（「クラス分類は保健所との相談の上で決定」と記載する）。Markdown形式（見出し・太字・箇条書き・表）で見やすく出力してください。日本語で回答してください。`

  const userText = isEn
    ? `Foreign matter: ${matterType}
Urgency: ${urgency}
Shipment status: ${statusText}

**Note**: "Urgency" reflects how quickly field response is needed. "Recall risk level" is a separate indicator assessing the risk of voluntary product recall. These are independent.

Please provide:
1. **Recall risk level** (High/Medium/Low) with rationale (legal basis: Food Sanitation Act Article 6, Item 4 where applicable)
2. Whether voluntary recall reporting under the Food Sanitation Act should be considered
3. Required actions by shipment status
4. Recall class reference: Do NOT state a class — note that "class must be determined through consultation with the health authority"
5. Table of consultation contacts (role | contact / scope)

⚠️ IMPORTANT: State clearly that this is decision-support material, NOT a final determination.`
    : `異物種別: ${matterType}
緊急度: ${urgency}
出荷状況: ${statusText}

**注意**: 「緊急度」は現場対応の急ぎ度を示す指標です。「回収リスクレベル」は製品の自主回収リスクを評価する別の指標です。両者は独立した指標です。

以下を Markdown 形式で提示してください:
1. **自主回収リスクレベル**（高/中/低）と根拠（根拠条文: 該当する場合は食品衛生法第6条第4号）
2. 食品衛生法に基づく自主回収届出の検討が必要かどうか
3. 出荷状況別の必要な対応
4. 回収クラスについて: CLASS I/II/III の断定はしない。「クラス分類は保健所との相談の上で決定」と記載すること
5. **相談先一覧**（区分 | 連絡先・対象 の表形式で記載）

⚠️ 必ず「これは判断材料であり最終判断ではありません。必ず責任者および保健所に相談してください」と明記すること。`

  const result = await callAIText(system, userText, 1500)

  // 必ず相談勧告を末尾に付加（AI が出力しなかった場合の保険）
  const disclaimer = isEn
    ? `\n\n⚠️ IMPORTANT: This is decision-support material only. NOT a final determination. Always consult your supervisor and the local health authority (保健所) before taking any recall or reporting action.`
    : `\n\n⚠️ 重要: これは判断材料です。最終判断ではありません。自主回収・届出の実施前に、必ず責任者および管轄の保健所に相談してください。`

  return result + disclaimer
}

/** 取引先向け第一報ドラフトを生成する（承認後のみ実行可） */
async function draftCustomerReport(
  matterType: string,
  discoveryDate: string,
  description: string,
  actionTaken: string,
  lang: string,
): Promise<string> {
  const isEn = lang === 'en'

  const system = isEn
    ? 'You are a food safety communication specialist. Draft a concise first notification report to business partners (customers/distributors) regarding a foreign matter incident. Be professional and factual. Respond in English only.'
    : '食品安全コミュニケーションの専門家として、取引先（卸売・小売）への異物事故第一報のドラフトを作成してください。簡潔・誠実・事実に基づいた内容で。日本語で回答してください。'

  const userText = isEn
    ? `Please draft a first notification letter to business partners for a foreign matter incident.

Foreign matter: ${matterType}
Discovery date: ${discoveryDate}
Incident description: ${description}
Actions taken so far: ${actionTaken}

Include: date, subject, incident overview, actions taken, next steps, contact information placeholder.
Mark all placeholder fields with [PLACEHOLDER].`
    : `以下の情報をもとに、取引先への異物事故第一報ドラフトを作成してください。

異物種別: ${matterType}
発見日: ${discoveryDate}
事案概要: ${description}
実施済み対応: ${actionTaken}

記載内容: 日付・件名・事案概要・対応状況・今後の対応・問い合わせ先（プレースホルダー）。
未確定の項目は【要記入】と記載すること。`

  return callAIText(system, userText, 1500)
}

/** Supabase の incidents テーブルで直近30日の傾向を確認し、繰り返しパターンがあれば警告 */
async function checkTrendAlert(
  matterType: string,
  location: string,
  lang: string,
): Promise<string> {
  try {
    const { getSupabaseAdmin } = await import('../supabase')
    const db = getSupabaseAdmin()

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const safeMatter = matterType.replace(/[%_\\]/g, (c) => `\\${c}`).slice(0, 60)
    const safeLocation = location.replace(/[%_\\]/g, (c) => `\\${c}`).slice(0, 60)

    // 同じ異物の種類（タイトル・説明で検索）
    const { data: byType } = await db
      .from('incidents')
      .select('id, title, location, created_at')
      .or(`title.ilike.%${safeMatter}%,description.ilike.%${safeMatter}%`)
      .gte('created_at', since)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(20)

    // 同じ場所（ロケーションで検索）
    const { data: byLocation } = safeLocation
      ? await db
          .from('incidents')
          .select('id, title, location, created_at')
          .ilike('location', `%${safeLocation}%`)
          .gte('created_at', since)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: null }

    const typeCount = byType?.length ?? 0
    const locationCount = byLocation?.length ?? 0
    const isEn = lang === 'en'

    const alerts: string[] = []
    if (typeCount >= 3) {
      alerts.push(
        isEn
          ? `⚠️ TREND ALERT: ${typeCount} incidents involving "${matterType}" in the past 30 days. Repeated occurrence detected — include in CAPA report and consider systemic root cause analysis.`
          : `⚠️ 傾向アラート: 直近30日間で「${matterType}」に関する事故が${typeCount}件あります。繰り返し発生しています — CAPA報告書に記録し、根本原因の体系的な分析を検討してください。`,
      )
    }
    if (safeLocation && locationCount >= 3) {
      const locLabel = isEn ? location : location
      alerts.push(
        isEn
          ? `⚠️ LOCATION ALERT: ${locationCount} incidents at "${locLabel}" in the past 30 days. Focus corrective actions on this area.`
          : `⚠️ 場所アラート: 直近30日間で「${locLabel}」での事故が${locationCount}件あります。この場所への集中的な是正処置を検討してください。`,
      )
    }

    if (alerts.length === 0) {
      return isEn
        ? `No trend alerts. Type count (30d): ${typeCount}${safeLocation ? `, Location count (30d): ${locationCount}` : ''}.`
        : `傾向アラートなし。直近30日: 同種 ${typeCount}件${safeLocation ? `、同場所 ${locationCount}件` : ''}。`
    }

    return alerts.join('\n\n')
  } catch (err) {
    return lang === 'en'
      ? `Trend check error: ${String(err)}`
      : `傾向チェックでエラーが発生しました: ${String(err)}`
  }
}

/** Supabase の incidents テーブルに異物事故を保存 */
async function saveIncidentToSupabase(
  title: string,
  location: string,
  description: string,
  urgency: string,
  lang = 'ja',
): Promise<string> {
  const { getSupabaseAdmin } = await import('../supabase')
  const db = getSupabaseAdmin()

  const agentPrefix = '🤖 Agent: '
  const { data, error } = await db
    .from('incidents')
    .insert([
      {
        title: agentPrefix + (title || 'Foreign Matter Incident'),
        location: location || '',
        description,
        status: urgency === 'high' ? 'investigating' : 'open',
        lang,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

// ── ツールコンテキストとルーター ──────────────────────────────────

export interface ToolContext {
  partialResult: PartialResult
  approved: boolean
  urgency: 'high' | 'medium' | 'low'
  approvalCalled: boolean
  lang: string
  approvedBy?: string
}

export interface ToolResult {
  output: string
  /** submit_for_approval のとき true */
  triggerApproval?: boolean
  approvalReason?: string
  checklistSummary?: string
}

export async function executeTool(
  name: string,
  args: Record<string, string>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // ── 承認ゲート強制 ──────────────────────────────────────────────
  // urgency=high: draft_capa_report / save_incident は承認前に実行不可
  // draft_customer_report: urgency に関係なく常に承認前に実行不可（回収判断は重大）
  if (
    !ctx.approved &&
    (
      (ctx.urgency === 'high' && (name === 'draft_capa_report' || name === 'save_incident')) ||
      name === 'draft_customer_report'
    )
  ) {
    return {
      output:
        ctx.lang === 'en'
          ? `APPROVAL REQUIRED: You must call submit_for_approval before calling ${name}. Please submit the checklist and recall assessment for approval first.`
          : `承認ゲート: ${name} を実行する前に submit_for_approval を呼び出してください。チェックリストと回収リスク評価を先に提出してください。`,
    }
  }

  switch (name) {
    case 'get_knowledge': {
      const output = getKnowledge(args.category ?? '')
      return { output }
    }

    case 'search_similar_incidents': {
      const output = await searchSimilarIncidents(args.keyword ?? '', ctx.lang)
      return { output }
    }

    case 'create_action_checklist': {
      const { checklist, text } = await createActionChecklist(
        args.foreign_matter ?? '',
        args.urgency ?? 'medium',
        ctx.lang,
      )
      ctx.partialResult.checklist = checklist
      return { output: text }
    }

    case 'submit_for_approval': {
      const reason = args.reason ?? ''
      const checklistSummary = args.checklist_summary ?? ''
      ctx.partialResult.approvalReason = reason
      ctx.partialResult.checklistSummary = checklistSummary
      ctx.approvalCalled = true
      const msg =
        ctx.lang === 'en'
          ? `Approval request submitted. Reason: ${reason}`
          : `承認申請を送信しました。理由: ${reason}`
      return {
        output: msg,
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
        ctx.approvedBy ?? (ctx.lang === 'en' ? 'Not set' : '未設定'),
        ctx.lang,
      )
      ctx.partialResult.capaReport = report
      return { output: report }
    }

    case 'save_incident': {
      const id = await saveIncidentToSupabase(
        args.product_name ?? '',
        args.location ?? '',
        args.description ?? '',
        args.urgency ?? ctx.urgency,
        ctx.lang,
      )
      ctx.partialResult.savedIncidentId = id
      const msg =
        ctx.lang === 'en'
          ? `Incident saved to Supabase. ID: ${id}`
          : `異物事故を Supabase に保存しました。ID: ${id}`
      return { output: msg }
    }

    case 'check_trend_alert': {
      const alert = await checkTrendAlert(
        args.matter_type ?? '',
        args.location ?? '',
        ctx.lang,
      )
      ctx.partialResult.trendAlert = alert
      return { output: alert }
    }

    case 'assess_recall_risk': {
      const assessment = await assessRecallRisk(
        args.matter_type ?? '',
        args.urgency ?? ctx.urgency,
        args.shipment_status ?? '',
        ctx.lang,
      )
      ctx.partialResult.recallAssessment = assessment
      return { output: assessment }
    }

    case 'draft_customer_report': {
      const report = await draftCustomerReport(
        args.matter_type ?? '',
        args.discovery_date ?? new Date().toLocaleDateString('ja-JP'),
        args.description ?? '',
        args.action_taken ?? '',
        ctx.lang,
      )
      ctx.partialResult.customerReport = report
      return { output: report }
    }

    default:
      return {
        output:
          ctx.lang === 'en'
            ? `Unknown tool: ${name}`
            : `不明なツール: ${name}`,
      }
  }
}

// ── ツール宣言（Gemini / Anthropic） ──────────────────────────────

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
    description:
      'チェックリストを担当者に提出し、承認を求める（緊急度 high の場合は必須）。ここでエージェントは一時停止する',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: '承認が必要な理由の説明' },
        checklist_summary: {
          type: 'STRING',
          description: 'チェックリストの要約（100文字以内）',
        },
      },
      required: ['reason', 'checklist_summary'],
    },
  },
  {
    name: 'draft_capa_report',
    description:
      '承認後に是正処置・予防処置（CAPA）報告書のドラフトを作成する。緊急度 high の場合は承認前に呼んではいけない',
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
    description:
      '異物事故記録を Supabase に保存する。緊急度 high の場合は承認前に呼んではいけない',
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
  {
    name: 'check_trend_alert',
    description:
      '直近30日間で同じ異物の種類・同じ場所の事故が繰り返し発生していないかを確認し、3件以上なら傾向アラートを生成する。save_incident の前に必ず呼ぶこと',
    parameters: {
      type: 'OBJECT',
      properties: {
        matter_type: { type: 'STRING', description: '異物の種類・名称' },
        location: { type: 'STRING', description: '発見場所・ライン番号（不明なら空文字）' },
      },
      required: ['matter_type'],
    },
  },
  {
    name: 'assess_recall_risk',
    description:
      '異物種別・緊急度・出荷状況から自主回収リスクを評価し、判断材料を提示する。AIは最終判断せず必ず相談先を提示する',
    parameters: {
      type: 'OBJECT',
      properties: {
        matter_type: { type: 'STRING', description: '異物の種類・名称' },
        urgency: { type: 'STRING', description: '緊急度（high/medium/low）' },
        shipment_status: {
          type: 'STRING',
          description: '出荷状況: not_shipped（未出荷）/ shipped_not_distributed（出荷済み市場未流通）/ in_market（市場流通中）',
        },
      },
      required: ['matter_type', 'urgency', 'shipment_status'],
    },
  },
  {
    name: 'draft_customer_report',
    description:
      '取引先向け第一報ドラフトを作成する。承認ゲートを通過してからのみ実行可能。AIは最終的な届出・回収決定はしない',
    parameters: {
      type: 'OBJECT',
      properties: {
        matter_type: { type: 'STRING', description: '異物の種類・名称' },
        discovery_date: { type: 'STRING', description: '発見日（YYYY-MM-DD）' },
        description: { type: 'STRING', description: '事案の概要' },
        action_taken: { type: 'STRING', description: 'すでに実施した対応' },
      },
      required: ['matter_type', 'discovery_date', 'description', 'action_taken'],
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
    description:
      'チェックリストを担当者に提出し、承認を求める（緊急度 high の場合は必須）。ここでエージェントは一時停止する',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: '承認が必要な理由の説明' },
        checklist_summary: {
          type: 'string',
          description: 'チェックリストの要約（100文字以内）',
        },
      },
      required: ['reason', 'checklist_summary'],
    },
  },
  {
    name: 'draft_capa_report',
    description:
      '承認後に是正処置・予防処置（CAPA）報告書のドラフトを作成する。緊急度 high の場合は承認前に呼んではいけない',
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
    description:
      '異物事故記録を Supabase に保存する。緊急度 high の場合は承認前に呼んではいけない',
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
  {
    name: 'check_trend_alert',
    description:
      '直近30日間で同じ異物の種類・同じ場所の事故が繰り返し発生していないかを確認し、3件以上なら傾向アラートを生成する。save_incident の前に必ず呼ぶこと',
    input_schema: {
      type: 'object' as const,
      properties: {
        matter_type: { type: 'string', description: '異物の種類・名称' },
        location: { type: 'string', description: '発見場所・ライン番号（不明なら空文字）' },
      },
      required: ['matter_type'],
    },
  },
  {
    name: 'assess_recall_risk',
    description:
      '異物種別・緊急度・出荷状況から自主回収リスクを評価し、判断材料を提示する。AIは最終判断せず必ず相談先を提示する',
    input_schema: {
      type: 'object' as const,
      properties: {
        matter_type: { type: 'string', description: '異物の種類・名称' },
        urgency: { type: 'string', description: '緊急度（high/medium/low）' },
        shipment_status: {
          type: 'string',
          description: '出荷状況: not_shipped / shipped_not_distributed / in_market',
        },
      },
      required: ['matter_type', 'urgency', 'shipment_status'],
    },
  },
  {
    name: 'draft_customer_report',
    description:
      '取引先向け第一報ドラフトを作成する。承認ゲートを通過してからのみ実行可能。AIは最終的な届出・回収決定はしない',
    input_schema: {
      type: 'object' as const,
      properties: {
        matter_type: { type: 'string', description: '異物の種類・名称' },
        discovery_date: { type: 'string', description: '発見日（YYYY-MM-DD）' },
        description: { type: 'string', description: '事案の概要' },
        action_taken: { type: 'string', description: 'すでに実施した対応' },
      },
      required: ['matter_type', 'discovery_date', 'description', 'action_taken'],
    },
  },
]
