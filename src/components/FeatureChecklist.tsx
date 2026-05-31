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
  accent?: 'orange' | 'blue'
}

function CheckboxGroup({ title, icon, subtitle, items, onToggle, accent = 'orange' }: CheckboxGroupProps) {
  const activeClass = accent === 'blue'
    ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200'
    : 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200'
  const hoverClass = accent === 'blue'
    ? 'border-blue-200 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
    : 'border-orange-200 text-gray-600 hover:border-orange-400 hover:bg-orange-50'

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">
        {icon} {title}
      </p>
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
  const size = value.size ?? {
    finePowder: false, longFiber: false, thinFilm: false,
    thickPiece: false, tiny: false, medium: false,
  }

  return (
    <div>
      {/* ① 触感 */}
      <CheckboxGroup
        title="触感"
        icon="👆"
        subtitle="触れたときの感触"
        items={[
          { key: 'hard', label: '固い', checked: value.texture.hard },
          { key: 'soft', label: '柔らかい', checked: value.texture.soft },
          { key: 'elastic', label: '弾力あり', checked: value.texture.elastic },
          { key: 'crumbly', label: '崩れやすい', checked: value.texture.crumbly },
          { key: 'sticky', label: '粘着あり', checked: value.texture.sticky },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            texture: { ...value.texture, [key]: !value.texture[key as keyof typeof value.texture] },
          })
        }
      />

      {/* ② 見た目・形状 */}
      <CheckboxGroup
        title="見た目・形状"
        icon="👁️"
        subtitle="形・構造・外観の特徴"
        items={[
          { key: 'fibrous', label: '繊維状', checked: value.appearance.fibrous },
          { key: 'breakSection', label: '破断面あり', checked: value.appearance.breakSection },
          { key: 'bent', label: '曲がり・変形', checked: value.appearance.bent },
          { key: 'layered', label: '層構造', checked: value.appearance.layered },
          { key: 'granular', label: '粒状', checked: value.appearance.granular },
          { key: 'bubbly', label: '泡状・気泡', checked: value.appearance.bubbly },
          { key: 'transparent', label: '透明感', checked: value.appearance.transparent },
          { key: 'translucent', label: '半透明', checked: value.appearance.translucent },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            appearance: {
              ...value.appearance,
              [key]: !value.appearance[key as keyof typeof value.appearance],
            },
          })
        }
      />

      {/* ③ 表面特徴 */}
      <CheckboxGroup
        title="表面特徴"
        icon="🔎"
        subtitle="表面の質感・状態"
        items={[
          { key: 'glossy', label: '光沢', checked: value.appearance.glossy },
          { key: 'matte', label: 'マット', checked: value.appearance.matte },
          { key: 'burned', label: '焦げ', checked: value.appearance.burned },
          { key: 'scratched', label: 'キズあり', checked: value.appearance.scratched },
          { key: 'patterned', label: '模様あり', checked: value.appearance.patterned },
          { key: 'rubbery', label: 'ゴム感', checked: value.appearance.rubbery },
          { key: 'metallic', label: '金属感', checked: value.appearance.metallic },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            appearance: {
              ...value.appearance,
              [key]: !value.appearance[key as keyof typeof value.appearance],
            },
          })
        }
      />

      {/* ④ 色 */}
      <CheckboxGroup
        title="色"
        icon="🎨"
        subtitle="異物の色調"
        items={[
          { key: 'black', label: '黒', checked: value.color.black },
          { key: 'brown', label: '茶・褐色', checked: value.color.brown },
          { key: 'white', label: '白・乳白', checked: value.color.white },
          { key: 'whiteTurbid', label: '白濁', checked: value.color.whiteTurbid },
          { key: 'metalColor', label: '金属光沢', checked: value.color.metalColor },
          { key: 'transparent', label: '透明', checked: value.color.transparent },
          { key: 'green', label: '緑', checked: value.color.green },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            color: { ...value.color, [key]: !value.color[key as keyof typeof value.color] },
          })
        }
      />

      {/* ⑤ サイズ感 */}
      <CheckboxGroup
        title="サイズ感"
        icon="📏"
        subtitle="異物のおおよその大きさ（AI推定精度向上に重要）"
        accent="blue"
        items={[
          { key: 'tiny', label: '微小 (<1mm)', checked: size.tiny },
          { key: 'finePowder', label: '微細粉', checked: size.finePowder },
          { key: 'medium', label: '中型 (1〜5mm)', checked: size.medium },
          { key: 'longFiber', label: '長い繊維 (>5mm)', checked: size.longFiber },
          { key: 'thinFilm', label: '薄膜状', checked: size.thinFilm },
          { key: 'thickPiece', label: '厚片・塊', checked: size.thickPiece },
        ]}
        onToggle={(key) => {
          const newSize = { ...size, [key]: !size[key as keyof typeof size] }
          onChange({ ...value, size: newSize })
        }}
      />

      {/* ⑥ におい */}
      <CheckboxGroup
        title="におい"
        icon="👃"
        subtitle="嗅いだときの特徴"
        items={[
          { key: 'burnedSmell', label: '焦げ臭', checked: value.smell.burnedSmell },
          { key: 'oilSmell', label: '油臭', checked: value.smell.oilSmell },
          { key: 'chemicalSmell', label: '薬品臭', checked: value.smell.chemicalSmell },
          { key: 'noSmell', label: '無臭', checked: value.smell.noSmell },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            smell: { ...value.smell, [key]: !value.smell[key as keyof typeof value.smell] },
          })
        }
      />

      {/* ⑦ 水試験 */}
      <CheckboxGroup
        title="水試験"
        icon="💧"
        subtitle="水に入れたときの挙動"
        items={[
          { key: 'floats', label: '浮く', checked: value.waterTest.floats },
          { key: 'sinks', label: '沈む', checked: value.waterTest.sinks },
          { key: 'dissolves', label: 'とける', checked: value.waterTest.dissolves },
          { key: 'oilSurface', label: '油浮き', checked: value.waterTest.oilSurface },
        ]}
        onToggle={(key) =>
          onChange({
            ...value,
            waterTest: {
              ...value.waterTest,
              [key]: !value.waterTest[key as keyof typeof value.waterTest],
            },
          })
        }
      />
    </div>
  )
}
