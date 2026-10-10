'use client'

import { useLang } from '@/context/LanguageContext'
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
  selectedLabel: string
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

function CheckboxGroup({ title, icon, subtitle, items, onToggle, accent = 'orange', selectedLabel }: CheckboxGroupProps) {
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
            {selectedLabel.replace('{n}', String(checkedCount))}
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
  const { t } = useLang()

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

  const sel = t('feat.selected')

  return (
    <div>

      {/* ① 触感 */}
      <CheckboxGroup
        title={t('feat.texture.title')}
        icon="👆"
        subtitle={t('feat.texture.sub')}
        accent="orange"
        selectedLabel={sel}
        items={[
          { key: 'hard',      label: t('feat.texture.hard'),     checked: tx.hard },
          { key: 'soft',      label: t('feat.texture.soft'),     checked: tx.soft },
          { key: 'elastic',   label: t('feat.texture.elastic'),  checked: tx.elastic },
          { key: 'crumbly',   label: t('feat.texture.crumbly'),  checked: tx.crumbly },
          { key: 'sticky',    label: t('feat.texture.sticky'),   checked: tx.sticky },
          { key: 'sharp',     label: t('feat.texture.sharp'),    checked: tx.sharp ?? false },
          { key: 'smooth',    label: t('feat.texture.smooth'),   checked: tx.smooth ?? false },
          { key: 'rough',     label: t('feat.texture.rough'),    checked: tx.rough ?? false },
          { key: 'coldFeel',  label: t('feat.texture.coldFeel'), checked: tx.coldFeel ?? false },
          { key: 'brittle',   label: t('feat.texture.brittle'),  checked: tx.brittle ?? false },
        ]}
        onToggle={(key) =>
          onChange({ ...value, texture: { ...tx, [key]: !tx[key as keyof typeof tx] } })
        }
      />

      {/* ② 形状・構造 */}
      <CheckboxGroup
        title={t('feat.shape.title')}
        icon="📐"
        subtitle={t('feat.shape.sub')}
        accent="orange"
        selectedLabel={sel}
        items={[
          { key: 'fibrous',     label: t('feat.shape.fibrous'),      checked: ap.fibrous },
          { key: 'wireShape',   label: t('feat.shape.wireShape'),    checked: ap.wireShape ?? false },
          { key: 'needleShape', label: t('feat.shape.needleShape'),  checked: ap.needleShape ?? false },
          { key: 'spiralCoil',  label: t('feat.shape.spiralCoil'),   checked: ap.spiralCoil ?? false },
          { key: 'flatPlate',   label: t('feat.shape.flatPlate'),    checked: ap.flatPlate ?? false },
          { key: 'flakeChip',   label: t('feat.shape.flakeChip'),    checked: ap.flakeChip ?? false },
          { key: 'layered',     label: t('feat.shape.layered'),      checked: ap.layered },
          { key: 'granular',    label: t('feat.shape.granular'),     checked: ap.granular },
          { key: 'bubbly',      label: t('feat.shape.bubbly'),       checked: ap.bubbly },
          { key: 'breakSection',label: t('feat.shape.breakSection'), checked: ap.breakSection },
          { key: 'bent',        label: t('feat.shape.bent'),         checked: ap.bent },
        ]}
        onToggle={(key) =>
          onChange({ ...value, appearance: { ...ap, [key]: !ap[key as keyof typeof ap] } })
        }
      />

      {/* ③ 表面・外観 */}
      <CheckboxGroup
        title={t('feat.surface.title')}
        icon="🔎"
        subtitle={t('feat.surface.sub')}
        accent="orange"
        selectedLabel={sel}
        items={[
          { key: 'mirrorGloss', label: t('feat.surface.mirrorGloss'), checked: ap.mirrorGloss ?? false },
          { key: 'glossy',      label: t('feat.surface.glossy'),      checked: ap.glossy },
          { key: 'matte',       label: t('feat.surface.matte'),       checked: ap.matte },
          { key: 'translucent', label: t('feat.surface.translucent'), checked: ap.translucent },
          { key: 'transparent', label: t('feat.surface.transparent'), checked: ap.transparent },
          { key: 'metallic',    label: t('feat.surface.metallic'),    checked: ap.metallic },
          { key: 'rubbery',     label: t('feat.surface.rubbery'),     checked: ap.rubbery },
          { key: 'burned',      label: t('feat.surface.burned'),      checked: ap.burned },
          { key: 'scratched',   label: t('feat.surface.scratched'),   checked: ap.scratched },
          { key: 'patterned',   label: t('feat.surface.patterned'),   checked: ap.patterned },
        ]}
        onToggle={(key) =>
          onChange({ ...value, appearance: { ...ap, [key]: !ap[key as keyof typeof ap] } })
        }
      />

      {/* ④ 色 */}
      <CheckboxGroup
        title={t('feat.color.title')}
        icon="🎨"
        subtitle={t('feat.color.sub')}
        accent="purple"
        selectedLabel={sel}
        items={[
          { key: 'black',       label: t('feat.color.black'),       checked: co.black },
          { key: 'gray',        label: t('feat.color.gray'),        checked: co.gray ?? false },
          { key: 'silver',      label: t('feat.color.silver'),      checked: co.silver ?? false },
          { key: 'metalColor',  label: t('feat.color.metalColor'),  checked: co.metalColor },
          { key: 'gold',        label: t('feat.color.gold'),        checked: co.gold ?? false },
          { key: 'copperRed',   label: t('feat.color.copperRed'),   checked: co.copperRed ?? false },
          { key: 'brown',       label: t('feat.color.brown'),       checked: co.brown },
          { key: 'red',         label: t('feat.color.red'),         checked: co.red ?? false },
          { key: 'orange',      label: t('feat.color.orange'),      checked: co.orange ?? false },
          { key: 'yellow',      label: t('feat.color.yellow'),      checked: co.yellow ?? false },
          { key: 'green',       label: t('feat.color.green'),       checked: co.green },
          { key: 'blue',        label: t('feat.color.blue'),        checked: co.blue ?? false },
          { key: 'pink',        label: t('feat.color.pink'),        checked: co.pink ?? false },
          { key: 'white',       label: t('feat.color.white'),       checked: co.white },
          { key: 'whiteTurbid', label: t('feat.color.whiteTurbid'), checked: co.whiteTurbid },
          { key: 'transparent', label: t('feat.color.transparent'), checked: co.transparent },
        ]}
        onToggle={(key) =>
          onChange({ ...value, color: { ...co, [key]: !co[key as keyof typeof co] } })
        }
      />

      {/* ⑤ サイズ感 */}
      <CheckboxGroup
        title={t('feat.size.title')}
        icon="📏"
        subtitle={t('feat.size.sub')}
        accent="blue"
        selectedLabel={sel}
        items={[
          { key: 'tiny',       label: t('feat.size.tiny'),       checked: size.tiny },
          { key: 'finePowder', label: t('feat.size.finePowder'), checked: size.finePowder },
          { key: 'medium',     label: t('feat.size.medium'),     checked: size.medium },
          { key: 'large',      label: t('feat.size.large'),      checked: size.large ?? false },
          { key: 'longFiber',  label: t('feat.size.longFiber'),  checked: size.longFiber },
          { key: 'thinFilm',   label: t('feat.size.thinFilm'),   checked: size.thinFilm },
          { key: 'thickPiece', label: t('feat.size.thickPiece'), checked: size.thickPiece },
        ]}
        onToggle={(key) => {
          const newSize = { ...size, [key]: !size[key as keyof typeof size] }
          onChange({ ...value, size: newSize })
        }}
      />

      {/* ⑥ 磁石試験 */}
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            🧲 {t('feat.magnet.title')}
          </p>
          <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
            {t('feat.magnet.badge')}
          </span>
        </div>
        <p className="text-[10px] text-amber-600 mb-3">
          {t('feat.magnet.sub')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'sticks',       labelKey: 'feat.magnet.sticks' },
              { key: 'noStick',      labelKey: 'feat.magnet.noStick' },
              { key: 'partialStick', labelKey: 'feat.magnet.partialStick' },
              { key: 'notTested',    labelKey: 'feat.magnet.notTested' },
            ] as { key: string; labelKey: Parameters<typeof t>[0] }[]
          ).map(({ key, labelKey }) => {
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
                {t(labelKey)}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-amber-500 mt-2">
          {t('feat.magnet.note')}
        </p>
      </div>

      {/* ⑦ 重さ感 */}
      <CheckboxGroup
        title={t('feat.weight.title')}
        icon="⚖️"
        subtitle={t('feat.weight.sub')}
        accent="teal"
        selectedLabel={sel}
        items={[
          { key: 'veryLight', label: t('feat.weight.veryLight'), checked: weight.veryLight },
          { key: 'heavy',     label: t('feat.weight.heavy'),     checked: weight.heavy },
        ]}
        onToggle={(key) =>
          onChange({ ...value, weight: { ...weight, [key]: !weight[key as keyof typeof weight] } })
        }
      />

      {/* ⑧ におい */}
      <CheckboxGroup
        title={t('feat.smell.title')}
        icon="👃"
        subtitle={t('feat.smell.sub')}
        accent="teal"
        selectedLabel={sel}
        items={[
          { key: 'noSmell',      label: t('feat.smell.noSmell'),      checked: sm.noSmell },
          { key: 'burnedSmell',  label: t('feat.smell.burnedSmell'),  checked: sm.burnedSmell },
          { key: 'oilSmell',     label: t('feat.smell.oilSmell'),     checked: sm.oilSmell },
          { key: 'metalSmell',   label: t('feat.smell.metalSmell'),   checked: sm.metalSmell ?? false },
          { key: 'rubberSmell',  label: t('feat.smell.rubberSmell'),  checked: sm.rubberSmell ?? false },
          { key: 'plasticSmell', label: t('feat.smell.plasticSmell'), checked: sm.plasticSmell ?? false },
          { key: 'chemicalSmell',label: t('feat.smell.chemicalSmell'),checked: sm.chemicalSmell },
          { key: 'sourSmell',    label: t('feat.smell.sourSmell'),    checked: sm.sourSmell ?? false },
        ]}
        onToggle={(key) =>
          onChange({ ...value, smell: { ...sm, [key]: !sm[key as keyof typeof sm] } })
        }
      />

      {/* ⑨ 水試験 */}
      <CheckboxGroup
        title={t('feat.water.title')}
        icon="💧"
        subtitle={t('feat.water.sub')}
        accent="blue"
        selectedLabel={sel}
        items={[
          { key: 'floats',     label: t('feat.water.floats'),     checked: value.waterTest.floats },
          { key: 'sinks',      label: t('feat.water.sinks'),      checked: value.waterTest.sinks },
          { key: 'dissolves',  label: t('feat.water.dissolves'),  checked: value.waterTest.dissolves },
          { key: 'oilSurface', label: t('feat.water.oilSurface'), checked: value.waterTest.oilSurface },
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
