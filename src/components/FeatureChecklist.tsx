'use client'

import type { FeatureChecklist } from '@/lib/types'

interface Props {
  value: FeatureChecklist
  onChange: (v: FeatureChecklist) => void
}

interface CheckItem {
  key: string
  label: string
  checked: boolean
}

interface CheckboxGroupProps {
  title: string
  icon: string
  subtitle?: string
  items: CheckItem[]
  onToggle: (key: string) => void
  accent?: 'orange' | 'blue' | 'purple' | 'teal' | 'red' | 'green'
}

const ACCENT: Record<string, { active: string; hover: string }> = {
  orange: {
    active: 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200',
    hover:  'border-orange-200 text-gray-600 hover:border-orange-400 hover:bg-orange-50',
  },
  blue: {
    active: 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200',
    hover:  'border-blue-200 text-gray-600 hover:border-blue-400 hover:bg-blue-50',
  },
  purple: {
    active: 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-200',
    hover:  'border-purple-200 text-gray-600 hover:border-purple-400 hover:bg-purple-50',
  },
  teal: {
    active: 'bg-teal-500 border-teal-500 text-white shadow-md shadow-teal-200',
    hover:  'border-teal-200 text-gray-600 hover:border-teal-400 hover:bg-teal-50',
  },
  red: {
    active: 'bg-red-500 border-red-500 text-white shadow-md shadow-red-200',
    hover:  'border-red-200 text-gray-600 hover:border-red-400 hover:bg-red-50',
  },
  green: {
    active: 'bg-green-600 border-green-600 text-white shadow-md shadow-green-200',
    hover:  'border-green-200 text-gray-600 hover:border-green-400 hover:bg-green-50',
  },
}

function CheckboxGroup({ title, icon, subtitle, items, onToggle, accent = 'orange' }: CheckboxGroupProps) {
  const { active: activeClass, hover: hoverClass } = ACCENT[accent] ?? ACCENT.orange
  const checkedCount = items.filter(i => i.checked).length

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {icon} {title}
        </p>
        {checkedCount > 0 && (
          <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
            {checkedCount}選択
          </span>
        )}
      </div>
      {subtitle && <p className="text-[10px] text-gray-400 mb-2">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, label, checked }) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
              checked ? activeClass : `bg-white ${hoverClass}`
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeatureChecklistComponent({ value, onChange }: Props) {
  // 後方互換：既存レコードに新フィールドがない場合のデフォルト
  const size = value.size ?? {
    finePowder: false, longFiber: false, thinFilm: false,
    thickPiece: false, tiny: false, medium: false, large: false,
  }
  const magnetTest = value.magnetTest ?? {
    sticks: false, noStick: false, partialStick: false, notTested: true,
  }
  const weight = value.weight ?? { veryLight: false, heavy: false }

  const ap = value.appearance
  const co = value.color
  const sm = value.smell
  const tx = value.texture

  return (
    <div>

      {/* ① 触感 */}
      <CheckboxGroup
        title="触感"
        icon="👆"
        subtitle="触れたときの感触・質感"
        accent="orange"
        items={[
          { key: 'hard',      label: '固い',              checked: tx.hard },
          { key: 'soft',      label: '柔らかい',          checked: tx.soft },
          { key: 'elastic',   label: '弾力あり',          checked: tx.elastic },
          { key: 'crumbly',   label: '崩れやすい',        checked: tx.crumbly },
          { key: 'sticky',    label: '粘着あり',          checked: tx.sticky },
          { key: 'sharp',     label: '鋭い・尖り⚠️',      checked: tx.sharp ?? false },
          { key: 'smooth',    label: 'なめらか',          checked: tx.smooth ?? false },
          { key: 'rough',     label: 'ざらざら',          checked: tx.rough ?? false },
          { key: 'coldFeel',  label: '冷たい（熱伝導高）', checked: tx.coldFeel ?? false },
          { key: 'brittle',   label: '脆い・パキッと割れる', checked: tx.brittle ?? false },
        ]}
        onToggle={(key) =>
          onChange({ ...value, texture: { ...tx, [key]: !tx[key as keyof typeof tx] } })
        }
      />

      {/* ② 形状・構造 */}
      <CheckboxGroup
        title="形状・構造"
        icon="📐"
        subtitle="異物の全体的な形・構造"
        accent="orange"
        items={[
          { key: 'fibrous',     label: '繊維状・糸状',    checked: ap.fibrous },
          { key: 'wireShape',   label: '線状・針状・ワイヤー', checked: ap.wireShape ?? false },
          { key: 'needleShape', label: '棘状・ニードル',  checked: ap.needleShape ?? false },
          { key: 'spiralCoil',  label: 'コイル・らせん',  checked: ap.spiralCoil ?? false },
          { key: 'flatPlate',   label: '薄板・プレート状', checked: ap.flatPlate ?? false },
          { key: 'flakeChip',   label: 'フレーク・剥離片', checked: ap.flakeChip ?? false },
          { key: 'layered',     label: '層構造',          checked: ap.layered },
          { key: 'granular',    label: '粒状・ペレット状', checked: ap.granular },
          { key: 'bubbly',      label: '泡状・気泡あり',  checked: ap.bubbly },
          { key: 'breakSection',label: '破断面あり',       checked: ap.breakSection },
          { key: 'bent',        label: '曲がり・変形',    checked: ap.bent },
        ]}
        onToggle={(key) =>
          onChange({ ...value, appearance: { ...ap, [key]: !ap[key as keyof typeof ap] } })
        }
      />

      {/* ③ 表面・外観 */}
      <CheckboxGroup
        title="表面・外観"
        icon="🔎"
        subtitle="表面の質感・光沢・状態"
        accent="orange"
        items={[
          { key: 'mirrorGloss', label: '鏡面・強光沢（SUS等）', checked: ap.mirrorGloss ?? false },
          { key: 'glossy',      label: '光沢あり',              checked: ap.glossy },
          { key: 'matte',       label: 'マット・つや消し',      checked: ap.matte },
          { key: 'translucent', label: '半透明',                checked: ap.translucent },
          { key: 'transparent', label: '透明感',                checked: ap.transparent },
          { key: 'metallic',    label: '金属感',                checked: ap.metallic },
          { key: 'rubbery',     label: 'ゴム感',                checked: ap.rubbery },
          { key: 'burned',      label: '焦げ・炭化',            checked: ap.burned },
          { key: 'scratched',   label: 'キズ・スジあり',        checked: ap.scratched },
          { key: 'patterned',   label: '模様・印字あり',        checked: ap.patterned },
        ]}
        onToggle={(key) =>
          onChange({ ...value, appearance: { ...ap, [key]: !ap[key as keyof typeof ap] } })
        }
      />

      {/* ④ 色 */}
      <CheckboxGroup
        title="色"
        icon="🎨"
        subtitle="異物の主な色調（複数選択可）"
        accent="purple"
        items={[
          { key: 'black',       label: '黒・黒系',        checked: co.black },
          { key: 'gray',        label: '灰色・鉄灰',      checked: co.gray ?? false },
          { key: 'silver',      label: '銀色・シルバー',  checked: co.silver ?? false },
          { key: 'metalColor',  label: '金属光沢（汎用）', checked: co.metalColor },
          { key: 'gold',        label: '金色・黄金',      checked: co.gold ?? false },
          { key: 'copperRed',   label: '銅色・橙赤色',    checked: co.copperRed ?? false },
          { key: 'brown',       label: '茶・褐色・錆色',  checked: co.brown },
          { key: 'red',         label: '赤色・赤系',      checked: co.red ?? false },
          { key: 'orange',      label: '橙色',            checked: co.orange ?? false },
          { key: 'yellow',      label: '黄色',            checked: co.yellow ?? false },
          { key: 'green',       label: '緑色',            checked: co.green },
          { key: 'blue',        label: '青色',            checked: co.blue ?? false },
          { key: 'pink',        label: 'ピンク',          checked: co.pink ?? false },
          { key: 'white',       label: '白・乳白',        checked: co.white },
          { key: 'whiteTurbid', label: '白濁',            checked: co.whiteTurbid },
          { key: 'transparent', label: '透明・無色',      checked: co.transparent },
        ]}
        onToggle={(key) =>
          onChange({ ...value, color: { ...co, [key]: !co[key as keyof typeof co] } })
        }
      />

      {/* ⑤ サイズ感 */}
      <CheckboxGroup
        title="サイズ感"
        icon="📏"
        subtitle="異物のおおよその大きさ（AI推定精度に重要）"
        accent="blue"
        items={[
          { key: 'tiny',       label: '微小 (<1mm)',     checked: size.tiny },
          { key: 'finePowder', label: '粉末・粉状',      checked: size.finePowder },
          { key: 'medium',     label: '中型 (1〜5mm)',   checked: size.medium },
          { key: 'large',      label: '大型 (5mm超)',    checked: size.large ?? false },
          { key: 'longFiber',  label: '長い繊維 (>5mm)', checked: size.longFiber },
          { key: 'thinFilm',   label: '薄膜・フィルム状', checked: size.thinFilm },
          { key: 'thickPiece', label: '厚片・塊・ブロック', checked: size.thickPiece },
        ]}
        onToggle={(key) => {
          const newSize = { ...size, [key]: !size[key as keyof typeof size] }
          onChange({ ...value, size: newSize })
        }}
      />

      {/* ⑥ 磁石試験（金属種別判定の最重要テスト） */}
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            🧲 磁石試験
          </p>
          <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
            金属種別判定に最重要
          </span>
        </div>
        <p className="text-[10px] text-amber-600 mb-3">
          磁石を異物に近づけたときの反応を選択してください
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'sticks',       label: '🔴 磁石につく（鉄・鋼系）' },
            { key: 'noStick',      label: '🔵 磁石につかない（SUS・Al・Cu等）' },
            { key: 'partialStick', label: '🟡 一部つく（複合材）' },
            { key: 'notTested',    label: '⬜ 未実施' },
          ].map(({ key, label }) => {
            const checked = magnetTest[key as keyof typeof magnetTest]
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const newMagnet = { sticks: false, noStick: false, partialStick: false, notTested: false }
                  onChange({ ...value, magnetTest: { ...newMagnet, [key]: true } })
                }}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                  checked
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-white border-amber-200 text-gray-600 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-amber-500 mt-2">
          ※ SUS304（一般的なステンレス）は磁石につきません。SUS430は一部つきます。
        </p>
      </div>

      {/* ⑦ 重さ感 */}
      <CheckboxGroup
        title="重さ感"
        icon="⚖️"
        subtitle="手で持ったときの重量感"
        accent="teal"
        items={[
          { key: 'veryLight', label: '非常に軽い（プラ・発泡・アルミ薄板）', checked: weight.veryLight },
          { key: 'heavy',     label: '重い・ずっしり（金属・ガラス・石）',   checked: weight.heavy },
        ]}
        onToggle={(key) =>
          onChange({ ...value, weight: { ...weight, [key]: !weight[key as keyof typeof weight] } })
        }
      />

      {/* ⑧ におい */}
      <CheckboxGroup
        title="におい"
        icon="👃"
        subtitle="嗅いだときの特徴"
        accent="teal"
        items={[
          { key: 'noSmell',      label: '無臭',              checked: sm.noSmell },
          { key: 'burnedSmell',  label: '焦げ臭',            checked: sm.burnedSmell },
          { key: 'oilSmell',     label: '油臭・潤滑油',      checked: sm.oilSmell },
          { key: 'metalSmell',   label: '金属臭・鉄臭',      checked: sm.metalSmell ?? false },
          { key: 'rubberSmell',  label: 'ゴム臭',            checked: sm.rubberSmell ?? false },
          { key: 'plasticSmell', label: 'プラスチック臭',    checked: sm.plasticSmell ?? false },
          { key: 'chemicalSmell',label: '薬品臭（その他）',   checked: sm.chemicalSmell },
          { key: 'sourSmell',    label: '酸臭・錆臭',        checked: sm.sourSmell ?? false },
        ]}
        onToggle={(key) =>
          onChange({ ...value, smell: { ...sm, [key]: !sm[key as keyof typeof sm] } })
        }
      />

      {/* ⑨ 水試験 */}
      <CheckboxGroup
        title="水試験"
        icon="💧"
        subtitle="少量の水に入れたときの挙動"
        accent="blue"
        items={[
          { key: 'floats',     label: '浮く',    checked: value.waterTest.floats },
          { key: 'sinks',      label: '沈む',    checked: value.waterTest.sinks },
          { key: 'dissolves',  label: 'とける',  checked: value.waterTest.dissolves },
          { key: 'oilSurface', label: '油膜浮き', checked: value.waterTest.oilSurface },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            waterTest: { ...value.waterTest, [key]: !value.waterTest[key as keyof typeof value.waterTest] },
          })
        }
      />

    </div>
  )
}
