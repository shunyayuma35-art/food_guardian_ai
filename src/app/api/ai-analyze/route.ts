import { NextRequest, NextResponse } from 'next/server'

// ── 月次使用制限（analyze-foreign-matter と共有） ─────────────────────
const USAGE_COOKIE = 'foodeye_usage'
const MAX_MONTHLY = 10

function parseUsage(val: string | undefined): { month: string; count: number } {
  const m = new Date().toISOString().slice(0, 7)
  if (!val) return { month: m, count: 0 }
  const [month, c] = val.split(':')
  return month === m ? { month: m, count: parseInt(c) || 0 } : { month: m, count: 0 }
}

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

その後、日本語で回答してください。**必ず最初の1文は以下の形式**：
「推定される異物：〇〇（可能性：〇〇%）」

続けて：
1. 写真から見える物理的特徴を具体的に列挙（色・形状・光沢・サイズ感・表面状態）
2. 推定の根拠・理由
3. 絞り込みのための確認質問を1〜2個

## 会話継続時の応答形式
- ユーザーの回答を踏まえて推定を更新
- 必要に応じて追加質問、または最終判定と具体的対応アドバイス
- 高危険度の場合：ロット隔離・出荷停止・金属探知機再検査を優先指示

必要に応じてクイック返信を追加：
[QUICK_REPLIES]
["選択肢1", "選択肢2", "選択肢3"]
[/QUICK_REPLIES]

## 食品異物データベース

### 虫類
- イエバエ：黒色・体長5〜8mm・翅2枚・複眼・6脚
- チョウバエ：黒褐色・体長2〜4mm・ハート形翅・排水溝発生
- ショウジョウバエ：赤眼・体長2〜3mm・果実周辺発生
- コクゾウムシ：茶褐色・体長3〜4mm・象鼻・穀物に発生
- カツオブシムシ：黒〜褐色・楕円形・乾燥食品に発生
- シバンムシ：赤褐色・体長2〜3mm・香辛料・乾燥食品
- ゴキブリ：黒褐色・扁平・体長15〜50mm
- アリ：黒〜赤褐色・体長2〜10mm・くびれあり

### 金属類
- ステンレス（SUS）：銀白色・光沢強・磁石につかない
- 鉄・鋼片：灰〜黒色・磁石につく・錆あり
- アルミ片：銀白色・軽量・磁石につかない・軟質
- ワッシャー：円形・中央穴・直径5〜15mm
- ボルト・ナット：六角形・ネジ山あり
- 針金：線状・曲がり・金属光沢

### プラスチック・樹脂類
- PE（ポリエチレン）：半透明〜白色・軟質・軽量
- PP（ポリプロピレン）：白〜透明・パレット・容器
- ゴム片：黒〜灰色・弾力・ゴム臭

### 植物・食品由来
- 魚骨：白〜黄白色・細長・弾力
- 甲殻類（海老足・カニ）：橙〜赤色・細い・曲がり
- 果実種（柚子・梅）：楕円形・硬質
- 竹串・木片：木質・細長・尖り

### 繊維類
- 作業着繊維：白〜グレー・細い繊維状
- パレット繊維：赤〜青・合成繊維
- 麻袋繊維：褐色・天然繊維・太め

### その他
- ガラス片：透明・光沢・鋭利・割れ口
- 毛髪：黒〜白・細長
- 骨片（鶏・豚）：白〜黄白色・硬質・不規則形

虫類は体型・色・翅の有無・触角・脚の本数から上記リストを参考に種類を推定すること。
金属類は磁石反応（つく＝鉄/鋼、つかない＝SUS/Al）を考慮すること。

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
  // 使用制限チェック（Claude解析と共有カウンター）
  const usage = parseUsage(req.cookies.get(USAGE_COOKIE)?.value)
  if (usage.count >= MAX_MONTHLY) {
    return NextResponse.json(
      { error: 'USAGE_LIMIT', message: '今月の無料解析上限（3回）に達しました。' },
      { status: 429 }
    )
  }

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
    userHint?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '不正なリクエスト形式です。' }, { status: 400 })
  }

  const { messages, imageBase64, mimeType = 'image/jpeg', userHint } = body

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messagesが必要です。' }, { status: 400 })
  }

  // Gemini API 用のメッセージ配列を構築
  // Gemini では role が "user" | "model"
  const geminiContents = messages.map((msg, idx) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'

    // 最初のユーザーメッセージ + 画像がある場合は画像を埋め込む
    if (idx === 0 && msg.role === 'user' && imageBase64) {
      const hintText = userHint ? `\n\nユーザー提供情報：${userHint}` : ''
      return {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          { text: msg.content + hintText },
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
      maxOutputTokens: 800,
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

    const remaining = MAX_MONTHLY - (usage.count + 1)
    const finalRes = NextResponse.json({ message, analysis, quickReplies, remaining })
    finalRes.cookies.set(USAGE_COOKIE, `${usage.month}:${usage.count + 1}`, {
      httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 40,
    })
    return finalRes
  } catch (err) {
    console.error('[ai-analyze] fetch error:', err)
    return NextResponse.json({ error: 'ネットワークエラーが発生しました。' }, { status: 500 })
  }
}
