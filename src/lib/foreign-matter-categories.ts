export interface FMSubcategory {
  name: string
  nameEn: string
}

export interface FMCategory {
  name: string
  nameEn: string
  subs: FMSubcategory[]
}

export const FM_CATEGORIES: FMCategory[] = [
  {
    name: '金属',
    nameEn: 'Metal',
    subs: [
      { name: 'ステンレス', nameEn: 'Stainless steel' },
      { name: '鉄', nameEn: 'Iron/Steel' },
      { name: 'アルミ', nameEn: 'Aluminum' },
      { name: '銅・真鍮', nameEn: 'Copper/Brass' },
      { name: 'ねじ・ナット・ワッシャー', nameEn: 'Screw/Nut/Washer' },
      { name: 'ホチキス針・ワイヤー', nameEn: 'Staple/Wire' },
      { name: '刃物の欠け', nameEn: 'Blade fragment' },
    ],
  },
  {
    name: '樹脂・ゴム',
    nameEn: 'Resin/Rubber',
    subs: [
      { name: '硬質プラスチック片', nameEn: 'Hard plastic fragment' },
      { name: 'フィルム・ビニール', nameEn: 'Film/Vinyl' },
      { name: 'ゴム・パッキン', nameEn: 'Rubber/Gasket' },
      { name: '手袋の破片', nameEn: 'Glove fragment' },
      { name: '結束バンド', nameEn: 'Zip tie fragment' },
      { name: '塗膜片(ペンキ)', nameEn: 'Paint chip' },
    ],
  },
  {
    name: '設備・器具由来',
    nameEn: 'Equipment/Utensil origin',
    subs: [
      { name: '番重の破片', nameEn: 'Baking tray fragment' },
      { name: 'かごの破片・ささくれ', nameEn: 'Basket fragment/splinter' },
      { name: 'ブラシの毛', nameEn: 'Brush bristle' },
      { name: 'ベルトの破片', nameEn: 'Belt fragment' },
      { name: 'パッキンの欠け', nameEn: 'Gasket chip' },
      { name: '焼成機・天板・鉄板の炭化物', nameEn: 'Carbonized deposit from oven/tray' },
    ],
  },
  {
    name: '紙・シート類',
    nameEn: 'Paper/Sheet',
    subs: [
      { name: 'クッキングシート', nameEn: 'Cooking sheet' },
      { name: '段ボール・紙片', nameEn: 'Cardboard/Paper fragment' },
      { name: 'ラベル・シール片', nameEn: 'Label/Sticker fragment' },
      { name: 'パラフィン紙', nameEn: 'Paraffin paper' },
    ],
  },
  {
    name: 'ガラス・陶磁器・石',
    nameEn: 'Glass/Ceramic/Stone',
    subs: [
      { name: 'ガラス片', nameEn: 'Glass fragment' },
      { name: '陶磁器片', nameEn: 'Ceramic fragment' },
      { name: '石', nameEn: 'Stone' },
      { name: '砂', nameEn: 'Sand' },
    ],
  },
  {
    name: '木・植物',
    nameEn: 'Wood/Plant',
    subs: [
      { name: '木片・つまようじ', nameEn: 'Wood fragment/Toothpick' },
      { name: 'わら・籾殻', nameEn: 'Straw/Rice husk' },
      { name: '種・核', nameEn: 'Seed/Pit' },
      { name: '葉・茎・皮', nameEn: 'Leaf/Stem/Peel' },
    ],
  },
  {
    name: '骨・殻・原料由来',
    nameEn: 'Bone/Shell/Raw material',
    subs: [
      { name: '鶏の骨', nameEn: 'Chicken bone' },
      { name: '軟骨', nameEn: 'Cartilage' },
      { name: '筋・腱', nameEn: 'Tendon/Ligament' },
      { name: '魚の骨', nameEn: 'Fish bone' },
      { name: '稚魚・小魚(混獲)', nameEn: 'Small fish (bycatch)' },
      { name: '貝殻の破片', nameEn: 'Shell fragment' },
      { name: '甲殻類の殻(オキアミ・エビ)', nameEn: 'Crustacean shell (krill/shrimp)' },
      { name: '卵殻', nameEn: 'Eggshell' },
      { name: '魚の鱗', nameEn: 'Fish scale' },
    ],
  },
  {
    name: '寄生虫',
    nameEn: 'Parasite',
    subs: [
      { name: 'アニサキス', nameEn: 'Anisakis' },
      { name: 'その他の寄生虫', nameEn: 'Other parasite' },
    ],
  },
  {
    name: '毛髪・繊維',
    nameEn: 'Hair/Fiber',
    subs: [
      { name: '人毛', nameEn: 'Human hair' },
      { name: '体毛', nameEn: 'Body hair' },
      { name: '動物の毛', nameEn: 'Animal hair' },
      { name: '化学繊維', nameEn: 'Synthetic fiber' },
      { name: '綿・糸くず', nameEn: 'Cotton/Thread waste' },
      { name: '軍手の繊維', nameEn: 'Work glove fiber' },
    ],
  },
  {
    name: '虫(飛ぶ虫・外部侵入)',
    nameEn: 'Insect (flying – external entry)',
    subs: [
      { name: 'イエバエ', nameEn: 'Housefly' },
      { name: 'ニクバエ', nameEn: 'Blowfly' },
      { name: '蚊', nameEn: 'Mosquito' },
      { name: 'ユスリカ', nameEn: 'Midge' },
      { name: 'ガガンボ', nameEn: 'Crane fly' },
      { name: 'ガ類', nameEn: 'Moth' },
      { name: 'アザミウマ・ヨコバイ', nameEn: 'Thrips/Leafhopper' },
    ],
  },
  {
    name: '虫(飛ぶ虫・内部発生)',
    nameEn: 'Insect (flying – internal breeding)',
    subs: [
      { name: 'チョウバエ', nameEn: 'Moth fly' },
      { name: 'オオチョウバエ', nameEn: 'Drain fly' },
      { name: 'ショウジョウバエ', nameEn: 'Fruit fly' },
      { name: 'ノミバエ', nameEn: 'Phorid fly' },
      { name: 'キノコバエ', nameEn: 'Fungus gnat' },
    ],
  },
  {
    name: '虫(這う虫)',
    nameEn: 'Insect (crawling)',
    subs: [
      { name: 'チャバネゴキブリ', nameEn: 'German cockroach' },
      { name: 'クロゴキブリ', nameEn: 'Oriental cockroach' },
      { name: 'アリ', nameEn: 'Ant' },
      { name: 'シミ', nameEn: 'Silverfish' },
      { name: 'ダンゴムシ・ワラジムシ', nameEn: 'Pill bug/Sowbug' },
      { name: 'ハサミムシ', nameEn: 'Earwig' },
      { name: 'ムカデ・ゲジ', nameEn: 'Centipede' },
    ],
  },
  {
    name: '虫(貯穀害虫)',
    nameEn: 'Insect (stored grain pest)',
    subs: [
      { name: 'コクゾウムシ', nameEn: 'Rice weevil' },
      { name: 'タバコシバンムシ', nameEn: 'Cigarette beetle' },
      { name: 'ジンサンシバンムシ', nameEn: 'Drugstore beetle' },
      { name: 'ノシメマダラメイガ', nameEn: 'Indian meal moth' },
      { name: 'コクヌストモドキ', nameEn: 'Confused flour beetle' },
    ],
  },
  {
    name: '虫(微小な虫・その他)',
    nameEn: 'Insect (mite/tiny insect/other)',
    subs: [
      { name: 'チャタテムシ', nameEn: 'Psocid' },
      { name: 'コナダニ', nameEn: 'Flour mite' },
      { name: 'トビムシ', nameEn: 'Springtail' },
      { name: 'クモ', nameEn: 'Spider' },
      { name: '幼虫(ウジ・イモムシ)', nameEn: 'Larva (maggot/caterpillar)' },
    ],
  },
  {
    name: '小動物',
    nameEn: 'Small animal',
    subs: [
      { name: 'ネズミの糞・毛', nameEn: 'Rodent droppings/hair' },
      { name: 'ヤモリ', nameEn: 'Gecko' },
      { name: 'その他の小動物', nameEn: 'Other small animal' },
    ],
  },
  {
    name: '人由来の物品',
    nameEn: 'Personal item',
    subs: [
      { name: '絆創膏', nameEn: 'Bandage/Plaster' },
      { name: '爪', nameEn: 'Fingernail' },
      { name: '装飾品', nameEn: 'Jewelry/Accessory' },
      { name: '筆記具の破片', nameEn: 'Writing instrument fragment' },
    ],
  },
  {
    name: '化学的',
    nameEn: 'Chemical',
    subs: [
      { name: '潤滑油・グリス', nameEn: 'Lubricant/Grease' },
      { name: '洗剤', nameEn: 'Detergent' },
      { name: '変色', nameEn: 'Discoloration' },
      { name: '異臭', nameEn: 'Odor anomaly' },
    ],
  },
  {
    name: '食品由来(異物でない可能性)',
    nameEn: 'Food origin (may not be foreign matter)',
    subs: [
      { name: '原材料の固まり', nameEn: 'Raw material lump' },
      { name: '結晶(ストルバイト等)', nameEn: 'Crystal (struvite, etc.)' },
      { name: '製品自体の焦げ', nameEn: 'Product-own charring' },
    ],
  },
  {
    name: 'その他・不明',
    nameEn: 'Other/Unknown',
    subs: [],
  },
]

/** 大分類名一覧 */
export const FM_MAIN_CATEGORIES = FM_CATEGORIES.map(c => c.name)

/** 大分類名 → FMCategory */
export const FM_CATEGORY_MAP = new Map<string, FMCategory>(
  FM_CATEGORIES.map(c => [c.name, c])
)

/** 高緊急度と判断すべきカテゴリ・小分類名（健康被害・衛生害虫リスク） */
export const HIGH_URGENCY_NAMES = new Set([
  // 金属系
  '金属', 'ステンレス', '鉄', 'アルミ', '銅・真鍮', 'ねじ・ナット・ワッシャー', 'ホチキス針・ワイヤー', '刃物の欠け',
  // ガラス・石
  'ガラス・陶磁器・石', 'ガラス片', '陶磁器片',
  // 硬質プラ
  '硬質プラスチック片',
  // 寄生虫
  '寄生虫', 'アニサキス',
  // 衛生害虫
  'イエバエ', 'ニクバエ', '虫(飛ぶ虫・外部侵入)',
  'チャバネゴキブリ', 'クロゴキブリ', '虫(這う虫)',
  // 小動物
  'ネズミの糞・毛', '小動物',
])

/** AIカテゴリ文字列 → { main, sub } にマッピング */
export function mapAiCategoryToFM(aiCategory: string): { main: string; sub: string } {
  if (!aiCategory) return { main: '', sub: '' }
  const a = aiCategory

  if (/ステンレス/.test(a)) return { main: '金属', sub: 'ステンレス' }
  if (/ホチキス|ワイヤー/.test(a)) return { main: '金属', sub: 'ホチキス針・ワイヤー' }
  if (/ねじ|ナット|ワッシャー|ボルト/.test(a)) return { main: '金属', sub: 'ねじ・ナット・ワッシャー' }
  if (/刃物|刃の/.test(a)) return { main: '金属', sub: '刃物の欠け' }
  if (/アルミ/.test(a)) return { main: '金属', sub: 'アルミ' }
  if (/銅|真鍮/.test(a)) return { main: '金属', sub: '銅・真鍮' }
  if (/鉄|スチール/.test(a)) return { main: '金属', sub: '鉄' }
  if (/金属/.test(a)) return { main: '金属', sub: '' }

  if (/塗膜|ペンキ/.test(a)) return { main: '樹脂・ゴム', sub: '塗膜片(ペンキ)' }
  if (/手袋/.test(a)) return { main: '樹脂・ゴム', sub: '手袋の破片' }
  if (/結束バンド/.test(a)) return { main: '樹脂・ゴム', sub: '結束バンド' }
  if (/ゴム|パッキン/.test(a)) return { main: '樹脂・ゴム', sub: 'ゴム・パッキン' }
  if (/フィルム|ビニール/.test(a)) return { main: '樹脂・ゴム', sub: 'フィルム・ビニール' }
  if (/硬質プラスチック|硬質樹脂/.test(a)) return { main: '樹脂・ゴム', sub: '硬質プラスチック片' }
  if (/プラスチック|樹脂|ポリ/.test(a)) return { main: '樹脂・ゴム', sub: '' }

  if (/番重/.test(a)) return { main: '設備・器具由来', sub: '番重の破片' }
  if (/かご|籠|バスケット/.test(a)) return { main: '設備・器具由来', sub: 'かごの破片・ささくれ' }
  if (/ブラシ/.test(a)) return { main: '設備・器具由来', sub: 'ブラシの毛' }
  if (/ベルト/.test(a)) return { main: '設備・器具由来', sub: 'ベルトの破片' }
  if (/炭化|焦げ|黒い塊|炭/.test(a)) return { main: '設備・器具由来', sub: '焼成機・天板・鉄板の炭化物' }
  if (/設備|器具/.test(a)) return { main: '設備・器具由来', sub: '' }

  if (/クッキングシート|オーブンシート/.test(a)) return { main: '紙・シート類', sub: 'クッキングシート' }
  if (/段ボール|ダンボール/.test(a)) return { main: '紙・シート類', sub: '段ボール・紙片' }
  if (/ラベル|シール/.test(a)) return { main: '紙・シート類', sub: 'ラベル・シール片' }
  if (/パラフィン/.test(a)) return { main: '紙・シート類', sub: 'パラフィン紙' }
  if (/紙|シート|ペーパー/.test(a)) return { main: '紙・シート類', sub: '' }

  if (/ガラス/.test(a)) return { main: 'ガラス・陶磁器・石', sub: 'ガラス片' }
  if (/陶磁器|セラミック/.test(a)) return { main: 'ガラス・陶磁器・石', sub: '陶磁器片' }
  if (/砂/.test(a)) return { main: 'ガラス・陶磁器・石', sub: '砂' }
  if (/石/.test(a)) return { main: 'ガラス・陶磁器・石', sub: '石' }

  if (/木片|つまようじ/.test(a)) return { main: '木・植物', sub: '木片・つまようじ' }
  if (/わら|籾殻|もみ/.test(a)) return { main: '木・植物', sub: 'わら・籾殻' }
  if (/種|核/.test(a)) return { main: '木・植物', sub: '種・核' }
  if (/葉|茎|皮/.test(a)) return { main: '木・植物', sub: '葉・茎・皮' }
  if (/木|植物|野菜|草|穀物|米|根/.test(a)) return { main: '木・植物', sub: '' }

  if (/アニサキス/.test(a)) return { main: '寄生虫', sub: 'アニサキス' }
  if (/寄生虫/.test(a)) return { main: '寄生虫', sub: 'その他の寄生虫' }

  if (/鶏.*骨|骨.*鶏/.test(a)) return { main: '骨・殻・原料由来', sub: '鶏の骨' }
  if (/軟骨/.test(a)) return { main: '骨・殻・原料由来', sub: '軟骨' }
  if (/筋|腱/.test(a)) return { main: '骨・殻・原料由来', sub: '筋・腱' }
  if (/魚.*骨|骨.*魚|フィッシュ/.test(a)) return { main: '骨・殻・原料由来', sub: '魚の骨' }
  if (/稚魚|小魚/.test(a)) return { main: '骨・殻・原料由来', sub: '稚魚・小魚(混獲)' }
  if (/貝殻/.test(a)) return { main: '骨・殻・原料由来', sub: '貝殻の破片' }
  if (/甲殻|オキアミ|エビ.*殻/.test(a)) return { main: '骨・殻・原料由来', sub: '甲殻類の殻(オキアミ・エビ)' }
  if (/卵殻/.test(a)) return { main: '骨・殻・原料由来', sub: '卵殻' }
  if (/鱗/.test(a)) return { main: '骨・殻・原料由来', sub: '魚の鱗' }
  if (/骨|殻/.test(a)) return { main: '骨・殻・原料由来', sub: '' }

  if (/チョウバエ|オオチョウバエ/.test(a)) return { main: '虫(飛ぶ虫・内部発生)', sub: /オオ/.test(a) ? 'オオチョウバエ' : 'チョウバエ' }
  if (/ショウジョウバエ/.test(a)) return { main: '虫(飛ぶ虫・内部発生)', sub: 'ショウジョウバエ' }
  if (/ノミバエ/.test(a)) return { main: '虫(飛ぶ虫・内部発生)', sub: 'ノミバエ' }
  if (/キノコバエ/.test(a)) return { main: '虫(飛ぶ虫・内部発生)', sub: 'キノコバエ' }
  if (/チャバネ|クロゴキ|ゴキブリ/.test(a)) return { main: '虫(這う虫)', sub: /チャバネ/.test(a) ? 'チャバネゴキブリ' : 'クロゴキブリ' }
  if (/アリ/.test(a)) return { main: '虫(這う虫)', sub: 'アリ' }
  if (/ムカデ|ゲジ/.test(a)) return { main: '虫(這う虫)', sub: 'ムカデ・ゲジ' }
  if (/ハサミムシ/.test(a)) return { main: '虫(這う虫)', sub: 'ハサミムシ' }
  if (/ダンゴムシ|ワラジムシ/.test(a)) return { main: '虫(這う虫)', sub: 'ダンゴムシ・ワラジムシ' }
  if (/シミ/.test(a)) return { main: '虫(這う虫)', sub: 'シミ' }
  if (/コクゾウ/.test(a)) return { main: '虫(貯穀害虫)', sub: 'コクゾウムシ' }
  if (/タバコシバン|ジンサンシバン/.test(a)) return { main: '虫(貯穀害虫)', sub: /タバコ/.test(a) ? 'タバコシバンムシ' : 'ジンサンシバンムシ' }
  if (/ノシメ|メイガ/.test(a)) return { main: '虫(貯穀害虫)', sub: 'ノシメマダラメイガ' }
  if (/コクヌスト/.test(a)) return { main: '虫(貯穀害虫)', sub: 'コクヌストモドキ' }
  if (/チャタテ/.test(a)) return { main: '虫(微小な虫・その他)', sub: 'チャタテムシ' }
  if (/コナダニ/.test(a)) return { main: '虫(微小な虫・その他)', sub: 'コナダニ' }
  if (/ウジ|イモムシ|幼虫/.test(a)) return { main: '虫(微小な虫・その他)', sub: '幼虫(ウジ・イモムシ)' }
  if (/クモ/.test(a)) return { main: '虫(微小な虫・その他)', sub: 'クモ' }
  if (/イエバエ/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: 'イエバエ' }
  if (/ニクバエ/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: 'ニクバエ' }
  if (/ユスリカ/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: 'ユスリカ' }
  if (/ガガンボ/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: 'ガガンボ' }
  if (/ガ類|蛾/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: 'ガ類' }
  if (/虫類|昆虫|虫/.test(a)) return { main: '虫(飛ぶ虫・外部侵入)', sub: '' }

  if (/ネズミ|鼠/.test(a)) return { main: '小動物', sub: 'ネズミの糞・毛' }
  if (/ヤモリ/.test(a)) return { main: '小動物', sub: 'ヤモリ' }
  if (/小動物/.test(a)) return { main: '小動物', sub: '' }

  if (/絆創膏/.test(a)) return { main: '人由来の物品', sub: '絆創膏' }
  if (/爪/.test(a)) return { main: '人由来の物品', sub: '爪' }
  if (/装飾品|アクセ/.test(a)) return { main: '人由来の物品', sub: '装飾品' }
  if (/筆記具/.test(a)) return { main: '人由来の物品', sub: '筆記具の破片' }

  if (/潤滑油|グリス/.test(a)) return { main: '化学的', sub: '潤滑油・グリス' }
  if (/洗剤/.test(a)) return { main: '化学的', sub: '洗剤' }
  if (/変色/.test(a)) return { main: '化学的', sub: '変色' }
  if (/異臭/.test(a)) return { main: '化学的', sub: '異臭' }

  if (/原材料の固まり|塊/.test(a)) return { main: '食品由来(異物でない可能性)', sub: '原材料の固まり' }
  if (/ストルバイト|結晶/.test(a)) return { main: '食品由来(異物でない可能性)', sub: '結晶(ストルバイト等)' }
  if (/製品.*焦げ/.test(a)) return { main: '食品由来(異物でない可能性)', sub: '製品自体の焦げ' }

  if (/毛髪|人毛|体毛|繊維|糸/.test(a)) return { main: '毛髪・繊維', sub: '' }

  return { main: 'その他・不明', sub: '' }
}

/** プロンプト用コンパクトカテゴリリスト */
export function buildCategoryListForPrompt(lang: 'ja' | 'en'): string {
  return FM_CATEGORIES.map(cat => {
    const name = lang === 'en' ? cat.nameEn : cat.name
    const subs = cat.subs.map(s => lang === 'en' ? s.nameEn : s.name)
    return subs.length > 0 ? `${name}: ${subs.join(' / ')}` : name
  }).join('\n')
}
