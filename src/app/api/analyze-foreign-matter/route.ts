import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();
const REQUEST_TIMEOUT_MS = 30000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── 月次使用制限 ──────────────────────────────────────────────────────
const USAGE_COOKIE = 'foodeye_usage'
const MAX_MONTHLY = 10

function parseUsage(val: string | undefined): { month: string; count: number } {
  const m = new Date().toISOString().slice(0, 7)
  if (!val) return { month: m, count: 0 }
  const [month, c] = val.split(':')
  return month === m ? { month: m, count: parseInt(c) || 0 } : { month: m, count: 0 }
}

// ── 異物データベース（共通） ─────────────────────────────────────────
const FOREIGN_MATTER_DB = `## 食品異物データベース

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
- PVC（塩化ビニル）：透明〜着色・硬質
- ナイロン：白〜透明・繊維状・弾力あり
- ゴム片：黒〜灰色・弾力・ゴム臭

### 植物・食品由来
- 魚骨：白〜黄白色・細長・弾力・17mm程度
- 甲殻類（海老足・カニ）：橙〜赤色・細い・曲がり
- 果実種（柚子・梅）：楕円形・硬質
- 竹串・木片：木質・細長・尖り

### 繊維類
- 作業着繊維：白〜グレー・細い・繊維状
- 手袋繊維：白〜カラー・ニット状
- パレット繊維：赤〜青・合成繊維・17.5mm程度
- 麻袋繊維：褐色・天然繊維・太め

### その他
- ガラス片：透明・光沢・鋭利・割れ口
- 段ボール・紙片：褐色・層構造・湿気で変形
- 毛髪：黒〜白・細長・人毛or動物毛
- 骨片（鶏・豚）：白〜黄白色・硬質・不規則形`

export async function POST(req: NextRequest) {
  const usage = parseUsage(req.cookies.get(USAGE_COOKIE)?.value)
  if (usage.count >= MAX_MONTHLY) {
    return NextResponse.json(
      { error: 'USAGE_LIMIT', message: '今月の無料解析上限（3回）に達しました。' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json();
    const { imageBase64, mediaType, userHint, structured } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: '画像データが無効です。' }, { status: 400 });
    }

    if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { error: 'サポートされていない画像形式です。JPEG, PNG, GIF, WebP をお使いください。' },
        { status: 400 }
      );
    }

    const imageSizeBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (imageSizeBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `画像サイズが大きすぎます。5MB以下の画像をお使いください。（現在: ${Math.ceil(imageSizeBytes / 1024 / 1024)}MB）` },
        { status: 413 }
      );
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
    );

    const systemPrompt = structured
      ? `食品工場の異物特定専門家として画像を分析し、以下のJSONのみを返してください（説明文・前置き一切不要）。

${FOREIGN_MATTER_DB}

上記データベースを参照し、以下のJSON形式のみで回答してください：

{
  "name": "異物名（例：イエバエ、ステンレス片、青いプラスチック）",
  "category": "虫類|金属類|プラスチック類|植物由来|繊維類|その他",
  "confidence": "高|中|低",
  "urgency": "high|medium|low",
  "size_estimate": "推定サイズ（例：約5mm、1cm程度）",
  "color": ["色特徴1", "色特徴2"],
  "shape": ["形状特徴1"],
  "surface": ["表面特徴"],
  "touch": ["触感"],
  "magnet": "磁石につく|磁石につかない|不明",
  "route": ["推定経路1", "推定経路2"],
  "action": "推奨対応（1文で簡潔に）",
  "colorKeys": ["black|brown|white|gray|red|blue|green|yellow|orange|silver|metalColor|transparent のうち該当するもの"],
  "textureKeys": ["hard|soft|elastic|sharp|smooth|rough|brittle|sticky のうち該当するもの"],
  "appearanceKeys": ["glossy|matte|fibrous|metallic|rubbery|granular|flatPlate|wireShape のうち該当するもの"],
  "sizeKey": "tiny|medium|large|finePowder|longFiber|thinFilm|thickPiece のうち最も適切な1つ"
}`
      : `食品工場の異物特定専門家として画像を分析してください。

${FOREIGN_MATTER_DB}

上記データベースを参照し、虫類は体型・色・翅・触角・脚の本数から種類を推定すること。
金属は磁石反応（つく＝鉄/鋼、つかない＝SUS/Al/Cu）を考慮すること。

回答形式：
1行目（必須）：推定される異物：〇〇（信頼度：高/中/低）
【種類・材質】推定材質・根拠
【物理的特徴】色・形・光沢・サイズ・表面状態
【磁石反応】磁石につく/つかない/不明
【混入経路】優先順に1〜3点
【緊急度】高・中・低（理由）
【即時対応】箇条書き

末尾：確定診断には外部専門機関の鑑定が必要です`

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: structured ? 600 : 700,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 } },
            { type: 'text', text: structured
                ? `この異物を分析してJSON形式で回答してください。${userHint ? `ユーザー提供情報：${userHint}` : ''}`
                : `異物を特定してください。種類・材質・経路・緊急度を必ず含めてください。${userHint ? `\n\nユーザー提供情報：${userHint}` : ''}` }
          ]
        }]
      }),
      timeoutPromise
    ]) as any;

    if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
      return NextResponse.json({ error: '予期しないレスポンス形式です。' }, { status: 500 });
    }

    const textContent = response.content.find((c: { type: string }) => c.type === 'text');
    if (!textContent || typeof (textContent as { text?: string }).text !== 'string') {
      return NextResponse.json({ error: '画像解析結果が無効です。' }, { status: 500 });
    }

    const text = ((textContent as { text: string }).text).trim();
    if (text.length === 0) {
      return NextResponse.json({ error: '画像を解析できませんでした。より明確な画像をお試しください。' }, { status: 422 });
    }

    const remaining = MAX_MONTHLY - (usage.count + 1)

    let quickResult: Record<string, unknown> | null = null
    if (structured) {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { quickResult = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
      }
    }

    const finalRes = NextResponse.json({ result: text, remaining, ...(quickResult ? { quickResult } : {}) })
    finalRes.cookies.set(USAGE_COOKIE, `${usage.month}:${usage.count + 1}`, {
      httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 40,
    })
    return finalRes;
  } catch (error) {
    console.error('Image Analysis Error:', error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: '画像解析がタイムアウトしました。接続を確認して再度お試しください。' },
        { status: 504 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'リクエストの形式が無効です。' }, { status: 400 });
    }

    return NextResponse.json({ error: '画像解析中にエラーが発生しました。' }, { status: 500 });
  }
}
