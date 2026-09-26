import { NextRequest, NextResponse } from 'next/server'
import { callAI, type MediaType } from '@/lib/ai-provider'

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

### 魚類由来
- 魚骨（背骨・肋骨）：白〜黄白色・細長・硬質・弾力なし・先端鋭い・17mm程度
- 魚の尻尾（尾鰭）：扇状・骨格＋膜の複合構造・複数の細い骨が扇形に広がる・黄褐色〜白色
- 魚の鱗：丸形・薄い・半透明・同心円模様・銀白色
- 魚皮：薄膜状・銀色光沢・柔軟・裂けやすい

### 甲殻類由来
- エビの尾扇：キチン質のみ・節構造あり・硬質・橙〜赤色・骨格なし（魚の尻尾との違い）
- エビの足：細い・複数節・橙赤色
- カニ殻：硬質・キチン質・橙〜赤色

【魚類 vs エビの識別】
魚の尻尾（尾鰭）＝骨格＋膜の複合構造・複数骨が扇状に広がる。
エビの尾扇＝骨格なし・キチン質のみ・節がある。形が似ていても構造で区別する。

### 肉類・骨類
- 豚骨：白〜黄白色・太め・断面に海綿状骨髄・硬質
- 牛骨：白〜黄白色・大きめ・緻密・硬質
- 鶏骨：白色・細め・中空・軽量・割れやすい
- 軟骨（豚・鶏）：白色〜半透明・弾力あり・軟質・表面に光沢
- 骨片全般：不規則形・断面鋭利・白〜黄白色
- 腱・筋（スジ）：白色・繊維状・弾力あり・長い
- 皮（豚・鶏）：白〜黄色・薄膜状・コラーゲン質・軟質
- 脂肪塊：白〜クリーム色・軟質・油分あり・溶けやすい

### 釣り・漁業関連
- 釣り針：J字/S字型・先端鋭利・銀〜金色・鉄製は磁石につく・SUSはつかない・緊急度：最高🔴（消化管穿孔リスク）
- ナイロン釣り糸：透明〜白・細い・弾力あり
- PEライン：白〜カラー・極細繊維の束
- 漁業用網：合成繊維・緑〜青・網目状
- オキアミ：体長10〜20mm・橙〜赤色・触角・複眼あり・エビより細長い
- アミエビ：体長5〜10mm・半透明〜白色

### 貝類由来
- 貝殻：白〜灰色・硬質・層状構造・表面に縞模様・割れると鋭利・磁石につかない
- 貝の破片：不規則形・白〜茶色・薄い・鋭利な断面
- 真珠層（内側）：白色・虹色光沢・薄い
- ホタテ貝柱膜：薄い・白〜透明・繊維状
- 砂噛み（アサリ・シジミ）：細粒・灰〜黒色・ジャリっとした食感

【貝殻の識別】貝殻 vs プラスチック＝貝殻は層状・燃やすと石灰臭。貝殻 vs 骨＝貝殻は層状・骨は海綿状。

### 砂・土・無機物
- 砂粒：細粒〜粗粒・透明〜灰・茶色・硬質・ジャリっとした食感
- 土・泥：茶〜黒色・不定形・水に溶ける部分あり・根菜・野菜由来が多い
- 小石：丸みあり・硬質・灰〜茶色・磁石につかない
- 砂鉄：黒色・細粒・磁石につく・金属光沢・農産物由来
- セメント・コンクリート片：灰色・硬質・粉状〜塊状・工場建材由来

【砂の識別】砂は水に溶けない。添加物は水に溶けるものが多い。

### ガラス・陶器（要注意）
- ガラス片：透明〜白・鋭利・光沢強・割れ口不規則・緊急度：最高🔴（口腔・消化管裂傷リスク）
- 強化ガラス：細かい粒状に砕ける・蛍光灯・窓ガラス由来
- 陶器片：白〜茶色・不透明・硬質・断面鋭利・釉薬面は光沢あり
- 磁器片：白色・緻密・食器・タイル由来

【ガラスの識別】ガラスは溶けない。氷は常温で溶ける。

### 農薬・化学物質（目視困難）
- 農薬残留：無色〜白色粉末・臭気あり・目視困難・化学分析が必要
- 洗剤・消毒剤：泡立ち・特有臭・次亜塩素酸は塩素臭
- 潤滑油・グリス：黄〜黒色・油性・機械部品由来・臭気あり
- 塗料片：各色・薄い・光沢あり・剥離した塗膜
- 防虫剤：白色結晶〜錠剤・特有臭・保管庫由来

### カビ・微生物系
- カビ（白色）：白〜灰色・綿状・フワフワした菌糸・カビ臭・湿度管理不良が原因
- カビ（黒色）：黒〜緑色・点状〜面状・クラドスポリウム・アスペルギルス等
- カビ（青色）：青緑色・ペニシリウム・パン・果物に多い
- 酵母：白〜クリーム色・粒状・発酵臭・製造環境の二次汚染

【カビの識別】カビは拭くと広がる。加熱で死滅するが毒素（マイコトキシン）は残る。

### 植物・食品由来
- 果実種（柚子・梅）：楕円形・硬質
- 竹串・木片：木質・細長・尖り
- カボス棒：木質・細長・植物由来

### 繊維類
- 作業着繊維：白〜グレー・細い繊維状
- パレット繊維：赤〜青・合成繊維
- 麻袋繊維：褐色・天然繊維・太め

### その他
- 段ボール・紙片：褐色・層構造・湿気で変形
- 毛髪：黒〜白・細長

### 包装・梱包資材由来
- アルミ箔片：銀色・薄い・金属光沢・磁石につかない・折り目あり
- 包装フィルム片：透明〜白・薄い・PE/PP/PET素材・印刷あり
- ラベル・シール：白〜カラー・粘着面あり・印字あり
- 段ボール片：茶色・層構造・水で軟化・繊維状
- 輪ゴム：黄〜茶色・弾力・ゴム臭・細い環状
- テープ類（OPP・養生）：透明〜カラー・粘着あり・薄い
- 結束バンド：白〜黒・プラスチック・細長い・片側にギザギザ

### 作業用品・設備由来
- ゴム手袋片：黒〜白・薄い・弾力あり・ゴム臭
- ニトリル手袋：青〜紫・薄い・弾力あり・医療用に多い
- ネット（インナーキャップ）：白・網目状・ポリエステル繊維
- マスク片：白・不織布・繊維状・柔軟
- ペン・鉛筆片：黒〜カラー・プラスチックまたは木質
- 爪（人）：半透明〜白・薄い・湾曲・硬質・ケラチン質
- バンドエイド：肌色〜白・布または不織布＋粘着・金属探知機対応品あり
- ボタン：丸形・プラスチックまたは金属・中央に穴
- ファスナー金具：金属・小型・磁石につく場合あり

### 害虫・動物由来
- ネズミの糞：黒色・細長い楕円・約5〜10mm・硬質・強い臭気・緊急度：最高🔴（感染症リスク）
- ネズミの毛：灰〜茶色・細い・獣臭あり
- 猫・犬の毛：各色・人毛より太め・先端が尖る
- ゴキブリの糞：黒色・微小・点状・臭気あり
- 昆虫の脚・翅：各色・薄い・細い・虫特有の構造
- クモの巣：白〜透明・極細繊維・弾力あり

### 水・氷由来の異物
- 水垢・スケール：白〜灰色・硬質・炭酸カルシウム・配管内壁由来
- 錆（赤錆）：赤〜茶色・粉状〜フレーク・磁石につく・鉄管由来
- 緑青：緑色・粉状・銅管由来・磁石につかない
- 塩素化合物：白色結晶・消毒剤由来・水に溶ける

### 原料由来の自然異物
- 豆類の皮・莢：薄い・茶〜緑色・植物繊維・水に軟化
- 穀物の外皮（ふすま）：茶色・薄い・繊維状
- 香辛料の茎・種：茶〜黒色・硬質・独特の香り
- 海藻片：緑〜黒色・薄い・磁石につかない・海の香り
- 昆布の結晶（マンニトール）：白色・粉状・水に溶ける・異物ではないが誤認されやすい

### 誤認されやすい「異物に見えるもの」
- 昆布のマンニトール結晶 → 正常品
- 砂糖の再結晶 → 正常品
- たんぱく質の凝固（白い塊） → 加熱による変性
- 油脂の固化（白い塊） → 低温での脂肪分離
- 野菜の維管束 → 植物の正常組織
- スパイスの種 → 原料由来

## 緊急度基準
🔴 最高（即時出荷停止・保健所報告）：釣り針・ガラス片・金属片・農薬
🔴 高（ロット隔離・原因調査）：骨・貝殻・硬質プラスチック・カビ
🟡 中（記録・原因調査）：軟骨・魚皮・植物由来・繊維
🟢 低（記録のみ）：添加物かたまり・自社原料由来

虫類は体型・色・翅の有無・触角・脚の本数から上記リストを参考に種類を推定すること。
金属類は磁石反応（つく＝鉄/鋼、つかない＝SUS/Al）を考慮すること。

## 重要事項
- 確定診断は外部専門機関の鑑定が必要と必ず明示
- 高危険度（金属・ガラス・骨片）は必ずロット即時隔離を最初に指示
- 回答は簡潔・実用的に（箇条書き多用）
- 「緊急度」は urgency: "high" | "medium" | "low" で表現`

function buildLangInstruction(lang?: string): string {
  if (lang === 'en') {
    return '\n\nIMPORTANT — Language: Respond entirely in English. Use standard English names for foreign matter types (e.g., "housefly", "stainless steel fragment", "fish bone", "mold", "glass fragment", "plastic piece"). Use professional food safety English terminology throughout.'
  }
  return '\n\n日本語で回答してください。異物の種類名は従来通りの日本語名称を使用してください（例：イエバエ、ステンレス片、魚骨）。'
}

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
  // 使用制限チェック（analyze-foreign-matter と共有カウンター）
  const usage = parseUsage(req.cookies.get(USAGE_COOKIE)?.value)
  if (usage.count >= MAX_MONTHLY) {
    return NextResponse.json(
      { error: 'USAGE_LIMIT', message: '今月の無料解析上限（10回）に達しました。' },
      { status: 429 }
    )
  }

  let body: {
    messages: ChatMessage[]
    imageBase64?: string
    mimeType?: string
    userHint?: string
    lang?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '不正なリクエスト形式です。' }, { status: 400 })
  }

  const { messages, imageBase64, mimeType = 'image/jpeg', userHint, lang } = body

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messagesが必要です。' }, { status: 400 })
  }

  try {
    // 最後のメッセージを現在の発話、それ以前を履歴として分離
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: m.content,
    }))
    const lastMsg = messages[messages.length - 1]
    const hintSuffix = userHint ? `\n\nユーザー提供情報：${userHint}` : ''

    const images = imageBase64
      ? [{ base64: imageBase64, mediaType: mimeType as MediaType }]
      : undefined

    const aiResult = await callAI({
      system: SYSTEM_PROMPT + buildLangInstruction(lang),
      userText: lastMsg.content + hintSuffix,
      images,
      maxTokens: 800,
      history: history.length > 0 ? history : undefined,
    })

    const { analysis, message, quickReplies } = parseAnalysis(aiResult.text.trim())

    const remaining = MAX_MONTHLY - (usage.count + 1)
    const finalRes = NextResponse.json({ message, analysis, quickReplies, remaining })
    finalRes.cookies.set(USAGE_COOKIE, `${usage.month}:${usage.count + 1}`, {
      httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 40,
    })
    return finalRes
  } catch (err) {
    console.error('[ai-analyze] callAI error:', err)

    if (err instanceof Error && err.message === 'SERVER_LIMIT_EXCEEDED') {
      return NextResponse.json(
        { error: 'USAGE_LIMIT', message: 'サーバー側の月次上限に達しました。' },
        { status: 429 }
      )
    }

    return NextResponse.json({ error: 'AI解析中にエラーが発生しました。' }, { status: 500 })
  }
}
