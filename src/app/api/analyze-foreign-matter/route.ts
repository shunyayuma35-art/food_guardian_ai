import { NextRequest, NextResponse } from 'next/server';
import { callAI, type MediaType } from '@/lib/ai-provider';
import { FOREIGN_MATTER_DB } from '@/lib/foreign-matter-db';

const REQUEST_TIMEOUT_MS = 30000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── 月次使用制限 ──────────────────────────────────────────────────────
const USAGE_COOKIE = 'foodeye_usage'
const MAX_MONTHLY = parseInt(process.env.FREE_ANALYSIS_LIMIT ?? '10')
const HACKATHON_MODE = process.env.HACKATHON_MODE === 'true'

function parseUsage(val: string | undefined): { month: string; count: number } {
  const m = new Date().toISOString().slice(0, 7)
  if (!val) return { month: m, count: 0 }
  const [month, c] = val.split(':')
  return month === m ? { month: m, count: parseInt(c) || 0 } : { month: m, count: 0 }
}

// ── 1分あたりレートリミット（費用暴走防止）───────────────────────────
const _rateMap = new Map<string, number[]>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const prev = (_rateMap.get(ip) ?? []).filter(t => now - t < 60_000)
  if (prev.length >= 10) return false
  prev.push(now)
  _rateMap.set(ip, prev)
  return true
}

function buildLangInstruction(lang?: string): string {
  if (lang === 'en') {
    return '\n\nIMPORTANT — Language: Respond entirely in English. Use standard English names for foreign matter types (e.g., "housefly", "stainless steel fragment", "fish bone", "mold", "glass fragment", "plastic piece"). Use professional food safety English terminology throughout.'
  }
  return '\n\n日本語で回答してください。異物の種類名は従来通りの日本語名称を使用してください（例：イエバエ、ステンレス片、魚骨）。'
}

export async function POST(req: NextRequest) {
  // レートリミット（1分10回）
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'RATE_LIMIT', message: '1分間のリクエスト上限を超えました。少し待ってから再試行してください。' },
      { status: 429 }
    )
  }

  const usage = parseUsage(req.cookies.get(USAGE_COOKIE)?.value)
  if (!HACKATHON_MODE && usage.count >= MAX_MONTHLY) {
    return NextResponse.json(
      { error: 'USAGE_LIMIT', message: `今月の無料解析上限（${MAX_MONTHLY}回）に達しました。`, limit: MAX_MONTHLY },
      { status: 429 }
    )
  }

  try {
    const body = await req.json();
    const { imageBase64, mediaType, userHint, structured, lang } = body;

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

    const isEn = lang === 'en'
    const langInst = buildLangInstruction(lang as string | undefined)

    const systemPrompt = structured
      ? isEn
        ? `You are a food safety specialist. Analyze the image and return ONLY the following JSON (no explanation or preamble).

${FOREIGN_MATTER_DB}

Using the database above, respond ONLY in this JSON format:

{
  "name": "Foreign matter name (e.g.: housefly, stainless steel fragment, blue plastic piece)",
  "category": "insects|metal|plastic|plant-derived|fiber|other",
  "confidence": "High|Medium|Low",
  "urgency": "high|medium|low",
  "size_estimate": "Estimated size (e.g.: approx. 5mm, about 1cm)",
  "color": ["color feature 1", "color feature 2"],
  "shape": ["shape feature 1"],
  "surface": ["surface feature"],
  "touch": ["texture/feel"],
  "magnet": "Likely magnetic (visual estimate — requires actual measurement)|Likely non-magnetic (visual estimate — requires actual measurement)|Unknown",
  "route": ["estimated contamination route 1", "route 2"],
  "action": "Recommended action (concise, one sentence)",
  "colorKeys": ["black|brown|white|gray|red|blue|green|yellow|orange|silver|metalColor|transparent as applicable"],
  "textureKeys": ["hard|soft|elastic|sharp|smooth|rough|brittle|sticky as applicable"],
  "appearanceKeys": ["glossy|matte|fibrous|metallic|rubbery|granular|flatPlate|wireShape as applicable"],
  "sizeKey": "tiny|medium|large|finePowder|longFiber|thinFilm|thickPiece (most fitting one)"
}${langInst}`
        : `食品工場の異物特定専門家として画像を分析し、以下のJSONのみを返してください（説明文・前置き一切不要）。

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
  "magnet": "磁石につく可能性が高い（目視推測・要実測確認）|磁石につかない可能性が高い（目視推測・要実測確認）|不明",
  "route": ["推定経路1", "推定経路2"],
  "action": "推奨対応（1文で簡潔に）",
  "colorKeys": ["black|brown|white|gray|red|blue|green|yellow|orange|silver|metalColor|transparent のうち該当するもの"],
  "textureKeys": ["hard|soft|elastic|sharp|smooth|rough|brittle|sticky のうち該当するもの"],
  "appearanceKeys": ["glossy|matte|fibrous|metallic|rubbery|granular|flatPlate|wireShape のうち該当するもの"],
  "sizeKey": "tiny|medium|large|finePowder|longFiber|thinFilm|thickPiece のうち最も適切な1つ"
}${langInst}`
      : isEn
        ? `You are a food safety specialist. Analyze the image.

${FOREIGN_MATTER_DB}

For insects: identify species from body shape, color, wings, antennae, and leg count.
For metals: consider magnetic reaction (magnetic = iron/steel, non-magnetic = SUS/Al/Cu).

Response format:
Line 1 (required): Estimated foreign matter: [name] (Confidence: High/Medium/Low)
[Type / Material] Estimated material and basis
[Physical features] Color, shape, gloss, size, surface condition
[Magnetic reaction] Visual estimate only: Likely magnetic / Likely non-magnetic / Unknown (requires actual measurement)
[Contamination route] Priority order, 1-3 points
[Urgency] High / Medium / Low (reason)
[Immediate action] Bullet points

Note: External specialist assessment is required for definitive identification.

SIZE ESTIMATION: Look for reference objects (ruler, coin, credit card, pen, finger/hand).
- If found: output [SIZE]Estimated: approx. Xmm (reference: [object name])[/SIZE]
- If not found: output [SIZE]No reference object found — photograph with a coin or ruler to enable size estimation[/SIZE]
Mark all size values as estimated.

IMPORTANT — append these as the very last two lines (required):
[BBOX]{"y":0.0,"x":0.0,"h":0.0,"w":0.0}[/BBOX]
y=top edge, x=left edge, h=height, w=width (all 0.0–1.0 fraction of image dimensions). Enclose the foreign matter with a margin. If not clearly visible, use {"y":0.3,"x":0.3,"h":0.4,"w":0.4}.
[SIZE]...[/SIZE]${langInst}`
        : `食品工場の異物特定専門家として画像を分析してください。

${FOREIGN_MATTER_DB}

上記データベースを参照し、虫類は体型・色・翅・触角・脚の本数から種類を推定すること。
金属は磁石反応（つく＝鉄/鋼、つかない＝SUS/Al/Cu）を考慮すること。

回答形式：
1行目（必須）：推定される異物：〇〇（信頼度：高/中/低）
【種類・材質】推定材質・根拠
【物理的特徴】色・形・光沢・サイズ・表面状態
【磁石反応】目視推測のみ：つく可能性が高い / つかない可能性が高い / 不明（要実測確認）
【混入経路】優先順に1〜3点
【緊急度】高・中・低（理由）
【即時対応】箇条書き

末尾：確定診断には外部専門機関の鑑定が必要です

大きさの推定：定規・コイン・クレジットカード・ペン・指・手などの基準物体が写っている場合、異物のおよその大きさを推定してください。
- 基準物体あり: [SIZE]推定: 約Xmm（基準：[物体名]との比較）[/SIZE]
- 基準物体なし: [SIZE]参照なし — コインや定規と一緒に撮影すると大きさを推定できます[/SIZE]
大きさはすべて「推定値」として扱うこと。

重要 — 最後の2行に必ず以下を追記（省略不可）：
[BBOX]{"y":0.0,"x":0.0,"h":0.0,"w":0.0}[/BBOX]
y=上端、x=左端、h=高さ、w=幅（すべて画像全体に対する0.0〜1.0の比率）。異物を余裕を持って囲む。見えない場合は{"y":0.3,"x":0.3,"h":0.4,"w":0.4}を使用。
[SIZE]...[/SIZE]${langInst}`

    const userText = structured
      ? isEn
        ? `Analyze this foreign matter and respond in JSON format only.${userHint ? ` User info: ${userHint}` : ''}`
        : `この異物を分析してJSON形式で回答してください。${userHint ? `ユーザー提供情報：${userHint}` : ''}`
      : isEn
        ? `Identify the foreign matter. Must include type, material, contamination route, and urgency.${userHint ? `\n\nUser info: ${userHint}` : ''}`
        : `異物を特定してください。種類・材質・経路・緊急度を必ず含めてください。${userHint ? `\n\nユーザー提供情報：${userHint}` : ''}`

    // maxTokens: 2048 — thinking モデル(gemini-3.8-flash)は thinking + output の合計で消費するため大きめに設定
    const aiResult = await Promise.race([
      callAI({
        system: systemPrompt,
        userText,
        images: [{ base64: imageBase64, mediaType: mediaType as MediaType }],
        maxTokens: 2048,
      }),
      timeoutPromise,
    ]) as Awaited<ReturnType<typeof callAI>>;

    let rawText = aiResult.text.trim();
    if (rawText.length === 0) {
      return NextResponse.json({ error: '画像を解析できませんでした。より明確な画像をお試しください。' }, { status: 422 });
    }

    const remaining = HACKATHON_MODE ? null : MAX_MONTHLY - (usage.count + 1)

    // [BBOX]{...}[/BBOX] をパースして表示テキストから除去
    type BBox = { x: number; y: number; w: number; h: number }
    let bbox: BBox | null = null
    const bboxMatch = rawText.match(/\[BBOX\]([\s\S]*?)\[\/BBOX\]/i)
    if (bboxMatch) {
      try {
        const parsed = JSON.parse(bboxMatch[1].trim())
        const clamp = (v: number) => Math.max(0, Math.min(1, Number(v) || 0))
        bbox = {
          y: clamp(parsed.y ?? parsed.yMin ?? parsed.y_min ?? 0.3),
          x: clamp(parsed.x ?? parsed.xMin ?? parsed.x_min ?? 0.3),
          h: clamp(parsed.h ?? parsed.height ?? (parsed.yMax ?? parsed.y_max ?? 0.7) - (parsed.y ?? 0.3)),
          w: clamp(parsed.w ?? parsed.width  ?? (parsed.xMax ?? parsed.x_max ?? 0.7) - (parsed.x ?? 0.3)),
        }
      } catch { /* ignore */ }
      rawText = rawText.replace(bboxMatch[0], '').trim()
    }

    // [SIZE]...[/SIZE] をパースして表示テキストから除去
    let sizeEstimate: string | null = null
    const sizeMatch = rawText.match(/\[SIZE\]([\s\S]*?)\[\/SIZE\]/i)
    if (sizeMatch) {
      sizeEstimate = sizeMatch[1].trim()
      rawText = rawText.replace(sizeMatch[0], '').trim()
    }

    let quickResult: Record<string, unknown> | null = null
    if (structured) {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { quickResult = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
      }
    }

    const finalRes = NextResponse.json({
      result: rawText,
      ...(remaining !== null ? { remaining } : {}),
      limit: MAX_MONTHLY,
      ...(quickResult ? { quickResult } : {}),
      ...(bbox ? { bbox } : {}),
      ...(sizeEstimate ? { sizeEstimate } : {}),
    })
    if (!HACKATHON_MODE) {
      finalRes.cookies.set(USAGE_COOKIE, `${usage.month}:${usage.count + 1}`, {
        httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 40,
      })
    }
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
