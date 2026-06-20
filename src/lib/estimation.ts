import type { FeatureChecklist, DiscoveryProcess, EstimationResult } from './types'

const URGENCY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  // ── 金属系（高危険） ──
  '鉄・スチール片':       'high',
  'ステンレス片 (SUS)':   'high',
  'アルミニウム片':       'high',
  '銅・真鍮片':           'high',
  'ステープル・針金':     'high',
  '金属片（不明）':       'high',
  '骨片':                 'high',
  'ガラス片':             'high',
  '石・砂粒':             'high',
  'セラミック片':         'high',
  // ── 中リスク ──
  '虫・昆虫':             'medium',
  '毛髪・繊維':           'medium',
  '動物毛':               'medium',
  'ゴムパッキン':         'medium',
  'シリコーンゴム':       'medium',
  '手袋片':               'medium',
  '洗浄スポンジ':         'medium',
  '錆・酸化鉄':          'medium',
  'プラスチック硬質片':   'medium',
  '塗料・コーティング片': 'medium',
  // ── 低リスク ──
  '樹脂片（軟質）':       'low',
  '発泡スチロール':       'low',
  'テープ・粘着物':       'low',
  '炭化物':               'low',
  '木片':                 'low',
  '包材フィルム':         'low',
  '香辛料凝集':           'low',
  '紙・段ボール':         'low',
}

/** 各カテゴリの詳細アドバイス */
export interface ForeignObjectAdvice {
  description: string
  immediateActions: string[]
  investigation: string[]
  prevention: string[]
}

export function getForeignObjectAdvice(category: string): ForeignObjectAdvice {
  const adviceMap: Record<string, ForeignObjectAdvice> = {
    '鉄・スチール片': {
      description: '磁性金属（鉄・炭素鋼）の破片が混入した可能性があります。磁石に引き付けられます。',
      immediateActions: ['当該ロットを即時隔離', '金属探知機による全数再検査（Fe感度確認）', '発見現場の作業停止', '上長・品質部門に緊急報告'],
      investigation: ['磁石を使った鉄系判定確認', '使用機械・刃物・器具の欠損チェック', '設備の腐食・摩耗確認', '混入工程（ライン・シフト）の特定'],
      prevention: ['金属探知機のFe感度設定の見直し', '使用前後の部品カウント管理', '定期的な設備点検・防錆処理', '消耗品（刃物類）の交換記録管理'],
    },
    'ステンレス片 (SUS)': {
      description: 'ステンレス鋼（SUS）の破片が混入した可能性があります。SUS304は磁石につきません（鏡面・銀色）。',
      immediateActions: ['当該ロット即時隔離', 'X線検査または金属探知機SUS設定で全数確認', '上長・品質部門に緊急報告'],
      investigation: ['磁石試験で非磁性を確認（SUS304の特徴）', '鏡面光沢・銀色の特徴確認', '製造ラインのSUS製部品（ステンレスメッシュ・金具・刃）の欠損確認', '外部分析機関でのSUS成分分析'],
      prevention: ['SUS部品の定期点検スケジュール強化', 'X線検査機のSUS感度設定確認', 'ステンレス部品使用前後のカウント管理', 'メッシュ・フィルターの定期交換'],
    },
    'アルミニウム片': {
      description: 'アルミニウムまたはアルミ合金の破片が混入した可能性があります。軽量・非磁性・銀白色が特徴です。',
      immediateActions: ['当該ロット隔離', 'X線検査で全数確認（アルミはX線で検出しにくいため慎重に）', '上長報告'],
      investigation: ['非磁性・軽量・銀白色の特徴確認', 'アルミ製器具・ホイル・容器・蓋の欠損確認', 'X線透過率の確認（アルミは密度が低い）', '外部分析機関での成分分析'],
      prevention: ['アルミ製品の持込管理強化', 'アルミホイル・容器の使用記録管理', 'X線検査感度のアルミ対応確認（難検出に注意）', 'プラスチックや耐熱樹脂への材質変更検討'],
    },
    '銅・真鍮片': {
      description: '銅または真鍮（銅合金）の破片が混入した可能性があります。橙赤色〜金色で非磁性です。',
      immediateActions: ['当該ロット隔離', '金属探知機NonFe設定で全数確認', '上長・品質部門に報告'],
      investigation: ['非磁性・橙赤色（銅）または黄金色（真鍮）の特徴確認', '銅製配管・継手・バルブ・電気端子の欠損確認', '外部分析機関での成分分析'],
      prevention: ['銅製部品を食品接触部位で使用しない（ステンレス・樹脂へ変更）', '銅配管の腐食点検強化', '金属探知機NonFe感度設定の定期確認'],
    },
    'ステープル・針金': {
      description: 'ステープル・ホッチキス針・針金・ワイヤーが混入した可能性があります。線状・針状で非常に危険です。',
      immediateActions: ['当該ロット全量廃棄推奨', '金属探知機で全数確認', '発見現場のステープル使用を即時中止', '上長に緊急報告'],
      investigation: ['段ボール・包材の開梱記録確認', '製造ライン・作業エリアのステープル使用状況調査', '針金・ワイヤーの発生源特定（製造設備のワイヤー確認）'],
      prevention: ['製造エリアへのステープル・ホッチキス持込禁止', '開梱専用エリアの設置と分離', '包材の開梱方法をカッターに限定するルール策定', '針金結束を製造エリアで使用禁止'],
    },
    '金属片（不明）': {
      description: '金属系異物が混入した可能性がありますが、種類の特定が必要です。磁石試験と色・光沢で絞り込んでください。',
      immediateActions: ['当該ロットを即時隔離', '金属探知機で全数再検査', '上長・品質部門に緊急報告', '磁石試験・色・光沢で種類を絞り込む'],
      investigation: ['磁石試験（つく→鉄系 / つかない→SUS・Al・Cu）', 'X線検査での形状・サイズ確認', '使用機械器具の全欠損チェック', '外部分析機関での成分分析'],
      prevention: ['定期的な機械器具の目視・寸法点検', '金属探知機・X線検査機の感度確認強化', '作業着・持ち込み品管理の徹底'],
    },
    '骨片': {
      description: '原料肉・魚介類に由来する骨片が残存している可能性があります。',
      immediateActions: ['当該ロット・同一原料使用分の隔離', 'X線検査による全数確認', '仕入れ先への連絡'],
      investigation: ['使用原料ロット・仕入れ先の特定', 'X線検査で骨片位置・数量確認', '脱骨工程・原料規格の確認'],
      prevention: ['仕入れ先への原料規格強化要請', 'X線検査感度の骨片設定見直し', '原料受入検査の強化'],
    },
    'ガラス片': {
      description: '照明カバー・計器ガラス・容器などのガラスが破損して混入した可能性があります。非磁性・透明・非常に硬く危険です。',
      immediateActions: ['当該ロット全量隔離・廃棄', '作業エリアの立入禁止', '上長・品質部門に緊急報告', 'X線検査による確認'],
      investigation: ['周辺ガラス製品・照明カバーの破損確認', 'ガラス片の材質・成分分析（外部機関）', '混入工程の特定'],
      prevention: ['ガラス製品の持ち込み禁止・プラスチック代替', '照明・ガラス器具の保護カバー設置', 'ガラス破損時の管理手順整備'],
    },
    '石・砂粒': {
      description: '原料野菜・穀物・スパイスに付着した石や砂が洗浄・選別で除去しきれなかった可能性があります。',
      immediateActions: ['当該ロット隔離', '同一原料使用ロットの確認', '仕入れ先への連絡'],
      investigation: ['使用原料の産地・ロット特定', '洗浄・選別工程の確認', '比重選別機・ストーンセパレーターの動作確認'],
      prevention: ['原料受入時の石・砂混入検査強化', '洗浄工程の流水量・時間見直し', '比重選別・ストーンセパレーター導入'],
    },
    'セラミック片': {
      description: '磁器タイル・陶器・砥石・絶縁体などのセラミック製品の破片が混入した可能性があります。非磁性・硬い・マット面。',
      immediateActions: ['当該ロット隔離', 'X線検査による確認', '発見現場の作業停止'],
      investigation: ['製造ラインのセラミック部品・タイルの破損確認', '外部機関による成分分析'],
      prevention: ['セラミック部品・タイルの定期点検', '破損時の管理手順整備', 'X線検査感度のセラミック対応確認'],
    },
    '虫・昆虫': {
      description: '製造環境または原料に昆虫・その幼虫・卵が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '虫の種類・数量を記録・写真撮影', '害虫管理業者に連絡', '施設内の生息場所調査'],
      investigation: ['昆虫の種類同定（外部機関）', '混入経路の特定（原料/環境）', '粘着トラップの捕獲状況確認', '原料受入記録の確認'],
      prevention: ['エアカーテン・虫除けライト設置', '施設のシール強化（隙間・開口部）', '定期的な害虫防除（PCO）実施', '原料保管エリアの衛生管理強化'],
    },
    '毛髪・繊維': {
      description: '作業者の毛髪または衣類の繊維が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '発見当時の担当者・シフト記録確認'],
      investigation: ['毛髪か繊維かの判別（顕微鏡観察）', '衛生管理記録の確認', '混入工程の特定'],
      prevention: ['ヘアキャップ・ネット・フードの着用徹底', '入室前の粘着ローラー使用義務化', '定期的な毛髪管理研修'],
    },
    '動物毛': {
      description: 'ペットの毛・ネズミ・害獣の体毛が原料や施設経由で混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '動物・害獣の侵入状況確認', '害虫・害獣管理業者に緊急連絡'],
      investigation: ['動物毛の種類同定', '施設内の侵入経路確認', '原料保管場所の確認'],
      prevention: ['施設の密閉強化', '定期的な害獣防除（PCO）実施', 'ペット持ち込み禁止の徹底', '原料保管エリアの密閉管理'],
    },
    'ゴムパッキン': {
      description: '配管・バルブ・ポンプのゴムパッキン・Oリングが劣化・破損して混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '使用設備のパッキン全数確認', '類似色の製品原料との照合'],
      investigation: ['設備パッキンの欠損チェック', 'パッキン素材の同定', '整備記録の確認'],
      prevention: ['設備パッキンの定期交換スケジュール管理', 'パッキン交換後のカウント確認', '食品接触部位は食品衛生法適合素材を使用'],
    },
    'シリコーンゴム': {
      description: 'シリコーン製パッキン・ガスケット・モールドの破片が混入した可能性があります。耐熱性・白色〜透明・弾力あり。',
      immediateActions: ['当該ロット隔離', 'シリコーン使用部品の全数確認', '加熱工程後の混入の可能性を考慮'],
      investigation: ['製造ラインのシリコーン部品の欠損確認', 'シリコーン素材の成分確認（食品衛生法適合か）', '整備・交換記録の確認'],
      prevention: ['シリコーン部品の定期交換・点検強化', '交換前後のカウント管理', 'X線検査ではシリコーンが検出しにくいため目視検査併用'],
    },
    '手袋片': {
      description: '作業用手袋の一部が破損して混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '使用中の手袋を全数確認', '手袋使用記録を確認'],
      investigation: ['使用手袋の材質・色の照合', '手袋の破損状況確認', '作業工程の確認'],
      prevention: ['手袋は使用前後に破損確認を義務化', '色付き手袋（目立つ色）への切り替え', '金属探知機対応手袋の採用検討'],
    },
    '洗浄スポンジ': {
      description: '清掃用スポンジ・ブラシの破片が洗浄時に混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '使用スポンジ・ブラシの全数確認'],
      investigation: ['洗浄記録と使用器材の確認', '欠損片の材質・色の照合'],
      prevention: ['スポンジ・ブラシは使用前後の状態確認を義務化', '金属探知機対応スポンジの採用', '使用回数管理・定期交換の徹底'],
    },
    '錆・酸化鉄': {
      description: '設備・配管・道具の錆が剥落して混入した可能性があります。茶褐色・粉状・崩れやすい特徴。',
      immediateActions: ['当該ロット隔離', '周辺設備の錆の状態確認'],
      investigation: ['錆の発生箇所の特定', '設備の腐食・劣化状況確認', '整備記録の確認'],
      prevention: ['設備の定期点検・防錆処理', 'ステンレス素材への更新検討', '清掃後の水分除去徹底'],
    },
    'プラスチック硬質片': {
      description: 'PP・PE・PS・ABS等の硬質プラスチック部品・容器・搬送ベルトの破片が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '使用プラスチック部品・容器の欠損確認'],
      investigation: ['樹脂の材質・色の照合（使用部品と比較）', 'X線では検出困難なため目視・手触りで確認', '混入工程の特定'],
      prevention: ['プラスチック部品の定期点検・交換', '色付き器具（青など）の採用で視認性向上', '欠損品の使用禁止徹底'],
    },
    '塗料・コーティング片': {
      description: '設備・壁・床・容器の塗料やコーティング剤が剥離して混入した可能性があります。薄片・多様な色。',
      immediateActions: ['当該ロット隔離', '発見場所周辺の塗装面を確認'],
      investigation: ['剥離塗料の色・材質と周辺設備の塗装の照合', '塗装面の劣化・剥離状況の全数確認', '食品接触部位の塗料成分確認（食品衛生法適合か）'],
      prevention: ['食品接触部位への塗装禁止（ステンレスや樹脂で代替）', '塗装面の定期点検・補修', '食品衛生対応の塗料のみ使用'],
    },
    '樹脂片（軟質）': {
      description: '軟質プラスチック（PE・PP・PVC薄物）・搬送ベルト・ガスケットの破片の可能性があります。',
      immediateActions: ['当該ロット隔離', '使用プラスチック部品の欠損確認'],
      investigation: ['樹脂の材質・色の照合', '使用部品・容器の破損確認', '混入工程の特定'],
      prevention: ['プラスチック部品の定期点検・交換', '色付き器具（青など）の採用で視認性向上', '欠損品の使用禁止徹底'],
    },
    '発泡スチロール': {
      description: '発泡ポリスチレン（EPS）の破片が混入した可能性があります。非常に軽く白色・気泡構造が特徴です。',
      immediateActions: ['当該ロット隔離', '発泡スチロール梱包材の使用状況確認'],
      investigation: ['原料・副資材の梱包材（発泡スチロール）の使用記録確認', '開梱エリアの確認'],
      prevention: ['発泡スチロール梱包材の製造エリア持ち込み禁止', '代替梱包材（段ボール・プラコン）への切り替え', '開梱専用エリアの設置'],
    },
    'テープ・粘着物': {
      description: 'ガムテープ・OPPテープ・マスキングテープの破片または粘着残留物が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', 'テープ使用記録の確認'],
      investigation: ['テープの材質・色の照合', '開梱・補修作業でのテープ使用状況確認', '包装工程でのテープ管理確認'],
      prevention: ['製造ラインへのテープ持ち込み禁止・管理強化', 'テープ使用は専任担当者・記録を義務化', '食品接触面へのテープ使用禁止'],
    },
    '炭化物': {
      description: '食品原料や調味料が加熱工程で過度に焦げ、炭化した破片が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '加熱工程の温度・時間記録確認'],
      investigation: ['焦げの発生箇所（熱交換器・釜・オーブン）の確認', '温度制御システムの確認'],
      prevention: ['加熱工程の温度・時間管理強化', '定期的な設備清掃（焦げ付き除去）', '温度センサーの定期校正'],
    },
    '木片': {
      description: '木製パレット・木製器具・原料に混入していた木片の可能性があります。',
      immediateActions: ['当該ロット隔離', '使用木製器具の確認'],
      investigation: ['木材の種類・発生源の特定', '原料受入記録の確認'],
      prevention: ['木製器具・パレットの食品接触部への使用禁止', 'プラスチック・ステンレス製品への代替', '原料受入検査強化'],
    },
    '包材フィルム': {
      description: '包装フィルム・袋・ラベルの破片が包装工程で混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '包装工程の確認'],
      investigation: ['フィルムの材質・色の照合', '包装機の刃・ロールの確認'],
      prevention: ['包装機の刃・シール部品の定期点検', '包材の管理（断裁くずの回収）', '包材投入口の管理強化'],
    },
    '香辛料凝集': {
      description: '原料スパイス・調味料が吸湿・固化して塊状になった可能性があります（異物ではない可能性も）。',
      immediateActions: ['塊の成分を確認（原料との照合）', '当該ロットを一時保留'],
      investigation: ['使用原料ロットの成分確認', '保管条件（温湿度）の確認', '粉砕・混合工程の確認'],
      prevention: ['原料の適切な保管条件管理（防湿）', '粉砕機のスクリーン管理', '仕入れ先への原料品質基準強化要請'],
    },
    '紙・段ボール': {
      description: '原料包装紙・段ボール・ラベルの破片が混入した可能性があります。',
      immediateActions: ['当該ロット隔離', '開梱エリアの確認'],
      investigation: ['紙の材質・色の照合', '開梱・原料投入工程の確認'],
      prevention: ['開梱エリアと製造エリアの明確な分離', '原料投入時の異物確認チェック強化', '段ボールの製造エリア持ち込み禁止'],
    },
  }

  return adviceMap[category] ?? {
    description: '異物の詳細分析が必要です。',
    immediateActions: ['当該ロットを隔離', '上長・品質部門に報告'],
    investigation: ['外部分析機関への鑑定依頼', '発生工程の特定'],
    prevention: ['発生原因に応じた対策を実施'],
  }
}

export function estimateForeignMaterial(
  features: FeatureChecklist,
  process: DiscoveryProcess
): EstimationResult[] {
  type ScoreEntry = { raw: number; basis: string[] }
  const scores: Record<string, ScoreEntry> = {}
  const categories = Object.keys(URGENCY_MAP)
  categories.forEach((c) => (scores[c] = { raw: 0, basis: [] }))

  const add = (key: string, val: number, reason?: string) => {
    if (!scores[key]) return
    scores[key].raw += val
    if (reason && !scores[key].basis.includes(reason)) scores[key].basis.push(reason)
  }

  const { texture: tx, appearance: ap, color: co, smell: sm, waterTest: wt, size: sz } = features
  const mag = features.magnetTest ?? { sticks: false, noStick: false, partialStick: false, notTested: true }
  const wgt = features.weight ?? { veryLight: false, heavy: false }

  // ── 磁石試験（最重要：金属種別を強力に絞り込む） ──────────────────

  if (mag.sticks) {
    // 磁石につく → 鉄・スチール系（SUS・アルミ・銅は除外）
    add('鉄・スチール片',      60, '磁石につく')
    add('ステープル・針金',     30, '磁石につく')
    add('金属片（不明）',       20, '磁石につく')
    // 非磁性金属のスコアを減算
    add('ステンレス片 (SUS)',  -40, '')
    add('アルミニウム片',      -40, '')
    add('銅・真鍮片',          -40, '')
  }
  if (mag.noStick) {
    // 磁石につかない → SUS・アルミ・銅・ガラス・プラスチック系
    add('ステンレス片 (SUS)',   50, '磁石につかない')
    add('アルミニウム片',       40, '磁石につかない')
    add('銅・真鍮片',           35, '磁石につかない')
    add('ガラス片',             20, '磁石につかない')
    add('プラスチック硬質片',   15, '磁石につかない')
    // 鉄系のスコアを減算
    add('鉄・スチール片',      -50, '')
    add('錆・酸化鉄',         -30, '')
  }
  if (mag.partialStick) {
    add('鉄・スチール片',      25, '一部磁石につく')
    add('ステンレス片 (SUS)',   20, 'SUS430等の可能性')
    add('ステープル・針金',     20, '一部磁石につく')
    add('金属片（不明）',       15, '複合材の可能性')
  }

  // ── 色による金属種別判定 ──────────────────────────────────────────

  if (co.silver ?? false) {
    add('ステンレス片 (SUS)', 35, '銀色')
    add('アルミニウム片',     30, '銀色')
    add('鉄・スチール片',     10, '銀色')
    add('ステープル・針金',   15, '銀色')
  }
  if (co.gold ?? false) {
    add('銅・真鍮片',         40, '金色・黄金色')
    add('金属片（不明）',      10)
  }
  if ((co.copperRed ?? false) || co.orange) {
    add('銅・真鍮片',         45, '銅色・橙赤色')
    add('錆・酸化鉄',         20, '橙赤色')
  }
  if (co.gray ?? false) {
    add('鉄・スチール片',     25, '灰色')
    add('セラミック片',       15, '灰色')
    add('石・砂粒',           15, '灰色')
  }
  if (co.red ?? false) {
    add('手袋片',             20, '赤色')
    add('塗料・コーティング片', 15, '赤色')
    add('テープ・粘着物',     10, '赤色')
  }
  if (co.blue ?? false) {
    add('洗浄スポンジ',       25, '青色')
    add('手袋片',             20, '青色')
    add('テープ・粘着物',     10, '青色')
    add('包材フィルム',       10, '青色')
  }
  if (co.yellow ?? false) {
    add('洗浄スポンジ',       20, '黄色')
    add('包材フィルム',       15, '黄色')
    add('テープ・粘着物',     12, '黄色')
  }
  if (co.pink ?? false) {
    add('手袋片',             25, 'ピンク')
    add('塗料・コーティング片', 10)
  }
  if (co.metalColor) {
    add('金属片（不明）',      20, '金属光沢')
    add('鉄・スチール片',      10)
    add('ステンレス片 (SUS)',   10)
    add('アルミニウム片',       8)
  }

  // ── 形状による判定 ──────────────────────────────────────────────

  if (ap.wireShape ?? false) {
    add('ステープル・針金',    50, '線状・ワイヤー形')
    add('鉄・スチール片',     15, '線状')
    add('ステンレス片 (SUS)', 12, '線状')
    add('毛髪・繊維',         10)
  }
  if (ap.spiralCoil ?? false) {
    add('ステープル・針金',    35, 'コイル・らせん状')
    add('鉄・スチール片',     20, 'コイル形')
    add('ステンレス片 (SUS)', 15, 'コイル形')
    add('金属片（不明）',      10)
  }
  if (ap.needleShape ?? false) {
    add('骨片',               35, '棘状・針状')
    add('ステープル・針金',    25, '針状')
    add('ガラス片',           15, '針状')
  }
  if (ap.flatPlate ?? false) {
    add('アルミニウム片',      25, '薄板状')
    add('ステンレス片 (SUS)', 18, '薄板状')
    add('プラスチック硬質片',  20, '薄板状')
    add('塗料・コーティング片', 15, '薄板状')
    add('包材フィルム',        12)
  }
  if (ap.flakeChip ?? false) {
    add('塗料・コーティング片', 35, 'フレーク・剥離片')
    add('錆・酸化鉄',         20, '剥離片')
    add('包材フィルム',        15)
    add('セラミック片',        10)
  }
  if (ap.mirrorGloss ?? false) {
    add('ステンレス片 (SUS)',  40, '鏡面光沢')
    add('ガラス片',            25, '鏡面光沢')
    add('アルミニウム片',      15, '鏡面')
    add('プラスチック硬質片',   8)
  }

  // ── 触感による判定 ──────────────────────────────────────────────

  if (tx.sharp ?? false) {
    add('ガラス片',            25, '鋭い')
    add('金属片（不明）',       20, '鋭利な縁')
    add('ステンレス片 (SUS)',   15, '鋭い')
    add('骨片',                15, '鋭い')
    add('ステープル・針金',     10)
  }
  if (tx.coldFeel ?? false) {
    add('鉄・スチール片',      25, '冷たい（熱伝導高）')
    add('ステンレス片 (SUS)',   22, '冷たい')
    add('アルミニウム片',       18, '冷たい')
    add('銅・真鍮片',          20, '冷たい')
    add('ガラス片',            10, '冷たい')
  }
  if (tx.smooth ?? false) {
    add('ガラス片',            15, 'なめらか')
    add('ステンレス片 (SUS)',   12, 'なめらか')
    add('プラスチック硬質片',   12, 'なめらか')
    add('アルミニウム片',       10)
  }
  if (tx.rough ?? false) {
    add('石・砂粒',            20, 'ざらざら')
    add('骨片',                15, 'ざらざら')
    add('セラミック片',        15, 'ざらざら')
    add('錆・酸化鉄',         12, 'ざらざら')
  }
  if (tx.brittle ?? false) {
    add('ガラス片',            20, '脆い・割れやすい')
    add('セラミック片',        18, '脆い')
    add('炭化物',              15, '脆い')
    add('発泡スチロール',      15, '脆い')
    add('石・砂粒',            8)
  }

  // ── 重さ感 ──────────────────────────────────────────────────────

  if (wgt.veryLight) {
    add('発泡スチロール',      35, '非常に軽い')
    add('アルミニウム片',       20, '軽い')
    add('包材フィルム',        18, '軽い')
    add('テープ・粘着物',      12, '軽い')
    // 重い金属系を減算
    add('鉄・スチール片',     -15, '')
  }
  if (wgt.heavy) {
    add('鉄・スチール片',      20, '重い')
    add('銅・真鍮片',          18, '重い')
    add('ガラス片',            15, '重い')
    add('石・砂粒',            15, '重い')
    add('セラミック片',        12, '重い')
    add('ステンレス片 (SUS)',   12, '重い')
    // 軽い素材を減算
    add('発泡スチロール',      -20, '')
    add('アルミニウム片',       -5, '')
  }

  // ── 既存のスコアリングロジック ───────────────────────────────────

  // ── ゴムパッキン ──
  if (tx.elastic)  add('ゴムパッキン', 40, '弾力あり')
  if (co.black)    add('ゴムパッキン', 20, '黒色')
  if (!sm.burnedSmell) add('ゴムパッキン', 8)
  if (wt.sinks)    add('ゴムパッキン', 10)
  if (tx.soft)     add('ゴムパッキン', 10)
  if (ap.rubbery)  add('ゴムパッキン', 30, 'ゴム感')
  if (process === 'after_packaging' || process === 'before_packaging')
    add('ゴムパッキン', 20, '包装工程')

  // ── シリコーンゴム ──
  if (tx.elastic && !co.black && (co.white || (co.transparent ?? false)))
    add('シリコーンゴム', 40, '弾力+白/透明')
  if (tx.elastic && (sm.rubberSmell ?? false))  add('シリコーンゴム', 20, '弾力+ゴム臭')
  if (tx.elastic && !sm.burnedSmell)            add('シリコーンゴム', 10)
  if (co.white && tx.elastic)                   add('シリコーンゴム', 15, '白色+弾力')
  if (sm.rubberSmell ?? false)                  add('シリコーンゴム', 15, 'ゴム臭')

  // ── 鉄・スチール片 ──
  if (ap.metallic)   add('鉄・スチール片', 30, '金属感')
  if (wt.sinks)      add('鉄・スチール片', 15)
  if (tx.hard)       add('鉄・スチール片', 12)
  if (sm.metalSmell ?? false) add('鉄・スチール片', 20, '金属臭')
  if (co.brown && !mag.noStick) add('鉄・スチール片', 12, '錆色')
  if (sz?.thickPiece) add('鉄・スチール片', 8)

  // ── ステンレス片 (SUS) ──
  if (ap.metallic && (ap.mirrorGloss ?? false))  add('ステンレス片 (SUS)', 35, '金属感+鏡面')
  if (ap.glossy && tx.hard && !co.brown)         add('ステンレス片 (SUS)', 20, '光沢+固い')
  if (wt.sinks && tx.hard)                       add('ステンレス片 (SUS)', 12)
  if (ap.scratched)                              add('ステンレス片 (SUS)', 12, 'キズあり')

  // ── アルミニウム片 ──
  if (ap.metallic && !ap.mirrorGloss && !(co.silver ?? false))
    add('アルミニウム片', 10)
  if (ap.flatPlate ?? false)   add('アルミニウム片', 15, '薄板状')
  if (tx.soft && tx.hard)     add('アルミニウム片', 5) // やや柔らかい金属
  if (process === 'before_packaging' || process === 'after_packaging')
    add('アルミニウム片', 10, 'アルミ包材工程')

  // ── 銅・真鍮片 ──
  if (ap.metallic && (co.copperRed ?? false)) add('銅・真鍮片', 30, '金属感+銅色')
  if (wt.sinks)                               add('銅・真鍮片', 10)
  if (sm.metalSmell ?? false)                 add('銅・真鍮片', 12, '金属臭')
  if (tx.hard && ap.metallic)                 add('銅・真鍮片', 8)

  // ── ステープル・針金 ──
  if (ap.wireShape ?? false)   add('ステープル・針金', 35, 'ワイヤー形')
  if (ap.bent && ap.metallic) add('ステープル・針金', 20, '変形した金属片')
  if (tx.hard && ap.metallic) add('ステープル・針金', 10)
  if (sz?.longFiber && ap.metallic) add('ステープル・針金', 15, '長い金属繊維')

  // ── 金属片（不明） ──
  if (ap.metallic)   add('金属片（不明）', 25, '金属感')
  if (co.metalColor) add('金属片（不明）', 20, '金属光沢')
  if (tx.hard)       add('金属片（不明）', 10)
  if (ap.glossy)     add('金属片（不明）', 8)
  if (wt.sinks)      add('金属片（不明）', 8)
  if (ap.scratched)  add('金属片（不明）', 10, 'キズあり')

  // ── ガラス片 ──
  if (ap.translucent && tx.hard) add('ガラス片', 35, '半透明+固い')
  if ((ap.mirrorGloss ?? false) && tx.hard) add('ガラス片', 25, '鏡面+固い')
  if (ap.glossy && tx.hard)      add('ガラス片', 20, '光沢+固い')
  if (co.transparent && tx.hard) add('ガラス片', 18, '透明+固い')
  if (co.white && tx.hard && ap.glossy) add('ガラス片', 12)
  if (wt.sinks)                  add('ガラス片', 10)
  if (ap.breakSection)           add('ガラス片', 20, '破断面あり')
  if (sz?.thickPiece && ap.glossy) add('ガラス片', 12)

  // ── 石・砂粒 ──
  if (tx.hard && !ap.metallic)  add('石・砂粒', 22, '固い')
  if (tx.rough ?? false)        add('石・砂粒', 18, 'ざらざら')
  if (wt.sinks)                 add('石・砂粒', 12)
  if (sz?.finePowder)           add('石・砂粒', 20, '粉末状')
  if (sz?.tiny)                 add('石・砂粒', 15, '微小')
  if (!ap.glossy && !ap.metallic && tx.hard) add('石・砂粒', 10)
  if (process === 'raw_material_receipt' || process === 'before_heating')
    add('石・砂粒', 18, '原料工程')

  // ── セラミック片 ──
  if (tx.hard && ap.matte)       add('セラミック片', 28, '固い+マット')
  if (co.white && tx.hard)       add('セラミック片', 18, '白色+固い')
  if (wt.sinks && tx.hard)       add('セラミック片', 10)
  if (ap.breakSection && tx.hard) add('セラミック片', 15, '破断面あり')
  if (mag.noStick && tx.hard && !ap.metallic) add('セラミック片', 12, '非磁性+固い')

  // ── 毛髪・繊維 ──
  if (ap.fibrous)         add('毛髪・繊維', 52, '繊維状')
  if (co.black || co.brown) add('毛髪・繊維', 12)
  if (wt.sinks)           add('毛髪・繊維', 8)
  if (!tx.hard && !tx.elastic) add('毛髪・繊維', 10)
  if (sz?.longFiber)      add('毛髪・繊維', 25, '長い繊維')

  // ── 動物毛 ──
  if (ap.fibrous && (co.brown || co.white)) add('動物毛', 32, '繊維+茶/白色')
  if (sz?.longFiber && ap.fibrous) add('動物毛', 18, '長繊維')
  if (co.brown && ap.fibrous)      add('動物毛', 14, '茶色繊維')

  // ── 虫・昆虫 ──
  if (tx.crumbly)        add('虫・昆虫', 28, '崩れやすい')
  if (co.brown)          add('虫・昆虫', 14, '茶色')
  if (co.black)          add('虫・昆虫', 10)
  if (ap.fibrous)        add('虫・昆虫', 8)
  if (sz?.tiny)          add('虫・昆虫', 12, '微小')
  if (process === 'raw_material_receipt' || process === 'before_heating')
    add('虫・昆虫', 18, '加熱前')

  // ── 炭化物 ──
  if (sm.burnedSmell)    add('炭化物', 40, '焦げ臭')
  if (ap.burned)         add('炭化物', 36, '焦げ外観')
  if (co.black)          add('炭化物', 18, '黒色')
  if (process === 'after_heating') add('炭化物', 25, '加熱後')
  if (tx.crumbly)        add('炭化物', 10)

  // ── プラスチック硬質片 ──
  if (tx.hard && !ap.metallic && wt.floats) add('プラスチック硬質片', 30, '固い+浮く')
  if (tx.hard && !ap.metallic && ap.matte)  add('プラスチック硬質片', 22, '固い+マット')
  if (sm.plasticSmell ?? false)             add('プラスチック硬質片', 20, 'プラスチック臭')
  if (ap.flatPlate ?? false)                add('プラスチック硬質片', 15, '薄板状')
  if (wt.floats && tx.hard)                 add('プラスチック硬質片', 12)
  if (mag.noStick && tx.hard && !ap.metallic) add('プラスチック硬質片', 10, '非磁性+固い')

  // ── 樹脂片（軟質） ──
  if (ap.bubbly)         add('樹脂片（軟質）', 25, '気泡構造')
  if (ap.layered)        add('樹脂片（軟質）', 20, '層構造')
  if (ap.translucent)    add('樹脂片（軟質）', 16, '半透明')
  if (wt.floats)         add('樹脂片（軟質）', 12)
  if (!sm.burnedSmell)   add('樹脂片（軟質）', 5)
  if (sz?.thinFilm)      add('樹脂片（軟質）', 14, '薄膜状')

  // ── 発泡スチロール ──
  if (ap.bubbly && co.white) add('発泡スチロール', 45, '気泡+白色')
  if (wgt.veryLight && co.white) add('発泡スチロール', 35, '非常に軽い+白')
  if (tx.crumbly && co.white)    add('発泡スチロール', 25, '崩れやすい+白')
  if (wt.floats && co.white)     add('発泡スチロール', 20, '浮く+白')
  if (tx.brittle ?? false)       add('発泡スチロール', 12)

  // ── 木片 ──
  if (tx.hard && co.brown)       add('木片', 30, '固い+茶色')
  if (ap.fibrous && tx.hard)     add('木片', 22, '繊維状+固い')
  if (process === 'raw_material_receipt') add('木片', 15, '原料受入')

  // ── 包材フィルム ──
  if (ap.translucent && tx.soft) add('包材フィルム', 32, '半透明+柔らかい')
  if (wt.floats)                 add('包材フィルム', 20, '水に浮く')
  if (process === 'after_packaging') add('包材フィルム', 28, '包装後工程')
  if (!sm.burnedSmell && !sm.oilSmell) add('包材フィルム', 5)
  if (sz?.thinFilm)              add('包材フィルム', 18, '薄膜状')

  // ── テープ・粘着物 ──
  if (tx.sticky)                  add('テープ・粘着物', 45, '粘着あり')
  if (ap.layered && tx.sticky)    add('テープ・粘着物', 25, '層構造+粘着')
  if (sz?.thinFilm && tx.sticky)  add('テープ・粘着物', 20, '薄膜+粘着')
  if (wt.floats && tx.sticky)     add('テープ・粘着物', 10)

  // ── 手袋片 ──
  if (tx.elastic && (ap.translucent || co.white || (co.transparent ?? false)))
    add('手袋片', 40, '弾力+白/透明')
  if (co.white || (co.transparent ?? false)) add('手袋片', 12)
  if (tx.elastic && !co.black)   add('手袋片', 14, '弾力あり')
  if ((co.pink ?? false))        add('手袋片', 20, 'ピンク色')
  if ((co.blue ?? false) && tx.elastic) add('手袋片', 15, '青+弾力')

  // ── 洗浄スポンジ ──
  if (tx.soft && ap.bubbly)      add('洗浄スポンジ', 45, '柔らかい+気泡')
  if (co.green)                  add('洗浄スポンジ', 30, '緑色')
  if ((co.yellow ?? false) && tx.soft) add('洗浄スポンジ', 20, '黄色+柔らかい')
  if ((co.blue ?? false) && tx.soft)   add('洗浄スポンジ', 18, '青+柔らかい')
  if (tx.elastic)                add('洗浄スポンジ', 14)
  if (wt.floats)                 add('洗浄スポンジ', 10)

  // ── 錆・酸化鉄 ──
  if (co.brown && ap.granular)   add('錆・酸化鉄', 32, '茶色+粒状')
  if (co.brown && tx.crumbly)    add('錆・酸化鉄', 26, '茶色+崩れやすい')
  if (!ap.metallic && co.brown)  add('錆・酸化鉄', 14)
  if (sm.oilSmell && co.brown)   add('錆・酸化鉄', 10)
  if (sz?.finePowder && co.brown) add('錆・酸化鉄', 16, '茶色粉末')
  if (sm.sourSmell ?? false)      add('錆・酸化鉄', 15, '酸臭')
  if (ap.flakeChip ?? false)      add('錆・酸化鉄', 15, '剥離片')
  if (mag.sticks)                 add('錆・酸化鉄', 15, '磁石につく')

  // ── 塗料・コーティング片 ──
  if (ap.flakeChip ?? false)      add('塗料・コーティング片', 30, 'フレーク状')
  if (ap.layered && !tx.sticky)   add('塗料・コーティング片', 18, '層構造')
  if (sz?.thinFilm)               add('塗料・コーティング片', 15, '薄膜状')
  if (ap.patterned)               add('塗料・コーティング片', 12, '模様あり')

  // ── 香辛料凝集 ──
  if (ap.granular)               add('香辛料凝集', 30, '粒状')
  if (sm.oilSmell)               add('香辛料凝集', 14, '油臭')
  if (tx.crumbly)                add('香辛料凝集', 16, '崩れやすい')
  if (co.brown || co.green)      add('香辛料凝集', 10)

  // ── 骨片 ──
  if (tx.hard && co.white)       add('骨片', 30, '固い+白色')
  if (wt.sinks)                  add('骨片', 14)
  if (!ap.metallic)              add('骨片', 6)
  if (sz?.thickPiece)            add('骨片', 8)
  if (ap.needleShape ?? false)   add('骨片', 22, '棘状')
  if (tx.rough ?? false)         add('骨片', 10, 'ざらざら')

  // ── 紙・段ボール ──
  if (tx.soft && !tx.elastic)    add('紙・段ボール', 14, '柔らかい')
  if (ap.layered)                add('紙・段ボール', 18, '層構造')
  if (co.brown && ap.fibrous)    add('紙・段ボール', 16, '茶色+繊維')
  if (wt.dissolves)              add('紙・段ボール', 22, '水で溶ける')
  if (sz?.thinFilm)              add('紙・段ボール', 10)

  // ── フィルタリング・ランキング ──────────────────────────────────

  const filtered = Object.entries(scores)
    .filter(([, v]) => v.raw > 0)
    .sort((a, b) => b[1].raw - a[1].raw)
    .slice(0, 5)

  const total = filtered.reduce((s, [, v]) => s + v.raw, 0)

  return filtered.map(([category, v]) => ({
    category,
    probability: total > 0 ? Math.round((v.raw / total) * 100) : 0,
    basis: v.basis,
    urgency: URGENCY_MAP[category] ?? 'low',
  }))
}
