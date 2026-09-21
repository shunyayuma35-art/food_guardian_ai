import { NextRequest, NextResponse } from 'next/server';
import { callAI, type MediaType } from '@/lib/ai-provider';

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
- 作業着繊維：白〜グレー・細い・繊維状
- 手袋繊維：白〜カラー・ニット状
- パレット繊維：赤〜青・合成繊維・17.5mm程度
- 麻袋繊維：褐色・天然繊維・太め

### その他
- 段ボール・紙片：褐色・層構造・湿気で変形
- 毛髪：黒〜白・細長・人毛or動物毛

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
🟢 低（記録のみ）：添加物かたまり・自社原料由来`

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
  "magnet": "磁石につく可能性が高い（目視推測・要実測確認）|磁石につかない可能性が高い（目視推測・要実測確認）|不明",
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
【磁石反応】目視推測のみ：つく可能性が高い / つかない可能性が高い / 不明（要実測確認）
【混入経路】優先順に1〜3点
【緊急度】高・中・低（理由）
【即時対応】箇条書き

末尾：確定診断には外部専門機関の鑑定が必要です`

    const userText = structured
      ? `この異物を分析してJSON形式で回答してください。${userHint ? `ユーザー提供情報：${userHint}` : ''}`
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
