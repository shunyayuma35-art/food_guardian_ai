import { NextRequest, NextResponse } from 'next/server';
import { callAI, type MediaType } from '@/lib/ai-provider';
import { FOREIGN_MATTER_DB } from '@/lib/foreign-matter-db';

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

function buildLangInstruction(lang?: string): string {
  if (lang === 'en') {
    return '\n\nIMPORTANT — Language: Respond entirely in English. Use standard English names for foreign matter types (e.g., "housefly", "stainless steel fragment", "fish bone", "mold", "glass fragment", "plastic piece"). Use professional food safety English terminology throughout.'
  }
  return '\n\n日本語で回答してください。異物の種類名は従来通りの日本語名称を使用してください（例：イエバエ、ステンレス片、魚骨）。'
}

export async function POST(req: NextRequest) {
  const usage = parseUsage(req.cookies.get(USAGE_COOKIE)?.value)
  if (usage.count >= MAX_MONTHLY) {
    return NextResponse.json(
      { error: 'USAGE_LIMIT', message: '今月の無料解析上限（10回）に達しました。' },
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

Note: External specialist assessment is required for definitive identification.${langInst}`
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

末尾：確定診断には外部専門機関の鑑定が必要です${langInst}`

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

    const text = aiResult.text.trim();
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
