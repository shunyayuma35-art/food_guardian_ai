import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはFoodEye（食品異物管理システム）専用の異物特定AIアシスタントです。

## 役割
食品製造工場での異物混入事故において、写真分析と対話を通じて異物の種類特定・原因推定・即時対応指示を支援します。

## 初回（写真付き）の応答形式
必ず以下の形式で回答してください：

[ANALYSIS]
{
  "urgency": "high",
  "candidates": [
    {"name": "材質名", "probability": 55, "reason": "推定理由"},
    {"name": "材質名", "probability": 30, "reason": "推定理由"},
    {"name": "材質名", "probability": 15, "reason": "推定理由"}
  ],
  "visualFeatures": ["銀色の光沢", "薄片状", "角が鋭利"],
  "quickReplies": ["磁石につく", "磁石につかない", "未確認"]
}
[/ANALYSIS]

その後、日本語で：
1. 写真から見える物理的特徴を具体的に列挙（色・形状・光沢・サイズ感・表面状態）
2. 推定異物と根拠の説明
3. 絞り込みのための質問を1〜2個

## 会話継続時の応答形式
- ユーザーの回答を踏まえて推定を更新
- 必要に応じて追加質問、または最終判定と具体的対応アドバイス
- 高危険度の場合：ロット隔離・出荷停止・金属探知機再検査を優先指示

必要に応じてクイック返信を追加：
[QUICK_REPLIES]
["選択肢1", "選択肢2", "選択肢3"]
[/QUICK_REPLIES]

## 重要事項
- 確定診断は外部専門機関の鑑定が必要と必ず明示
- 高危険度（金属・ガラス・骨片）は必ずロット即時隔離を最初に指示
- 回答は簡潔・実用的に（箇条書き多用）
- 「緊急度」は urgency: "high" | "medium" | "low" で表現`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AnalysisResult {
  urgency: 'high' | 'medium' | 'low'
  candidates: { name: string; probability: number; reason: string }[]
  visualFeatures: string[]
  quickReplies: string[]
}

function parseAnalysis(text: string): { analysis: AnalysisResult | null; message: string; quickReplies: string[] } {
  let analysis: AnalysisResult | null = null
  let quickReplies: string[] = []
  let message = text

  const analysisMatch = text.match(/\[ANALYSIS\]([\s\S]*?)\[\/ANALYSIS\]/i)
  if (analysisMatch) {
    try {
      analysis = JSON.parse(analysisMatch[1].trim())
      message = text.replace(analysisMatch[0], '').trim()
    } catch {
      // JSON parse failure: ignore structured part
    }
  }

  const qrMatch = message.match(/\[QUICK_REPLIES\]([\s\S]*?)\[\/QUICK_REPLIES\]/i)
  if (qrMatch) {
    try {
      quickReplies = JSON.parse(qrMatch[1].trim())
      message = message.replace(qrMatch[0], '').trim()
    } catch {
      // ignore
    }
  } else if (analysis?.quickReplies?.length) {
    quickReplies = analysis.quickReplies
  }

  return { analysis, message, quickReplies }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI機能を利用するにはGEMINI_API_KEYの設定が必要です。Google AI Studio（aistudio.google.com）で無料取得できます。' },
      { status: 503 }
    )
  }

  let body: {
    messages: ChatMessage[]
    imageBase64?: string
    mimeType?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '不正なリクエスト形式です。' }, { status: 400 })
  }

  const { messages, imageBase64, mimeType = 'image/jpeg' } = body

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messagesが必要です。' }, { status: 400 })
  }

  // Gemini API 用のメッセージ配列を構築
  // Gemini では role が "user" | "model"
  const geminiContents = messages.map((msg, idx) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'

    // 最初のユーザーメッセージ + 画像がある場合は画像を埋め込む
    if (idx === 0 && msg.role === 'user' && imageBase64) {
      return {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          { text: msg.content },
        ],
      }
    }

    return {
      role,
      parts: [{ text: msg.content }],
    }
  })

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.4,
    },
  }

  try {
    const model = 'gemini-1.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[ai-analyze] Gemini API error:', response.status, errText)

      // APIキーが無効な場合の分かりやすいメッセージ
      if (response.status === 400 || response.status === 403) {
        return NextResponse.json(
          { error: 'APIキーが無効です。Google AI Studio でキーを確認してください。' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: 'AI APIの呼び出しに失敗しました。' }, { status: 500 })
    }

    const data = await response.json()
    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!rawText) {
      return NextResponse.json({ error: 'AI からの応答が空でした。' }, { status: 500 })
    }

    const { analysis, message, quickReplies } = parseAnalysis(rawText)

    return NextResponse.json({ message, analysis, quickReplies })
  } catch (err) {
    console.error('[ai-analyze] fetch error:', err)
    return NextResponse.json({ error: 'ネットワークエラーが発生しました。' }, { status: 500 })
  }
}
