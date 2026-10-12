'use client'

import { useLang } from '@/context/LanguageContext'
import type { ForeignMatterHints, HintAnswer } from '@/lib/types'
import type { TranslationKey } from '@/lib/i18n'

interface Props {
  value: ForeignMatterHints
  onChange: (v: ForeignMatterHints) => void
}

type HintKey = keyof ForeignMatterHints

interface HintItem {
  key: HintKey
  label: TranslationKey
}

const SHAPE_ITEMS: HintItem[] = [
  { key: 'shapeGranular', label: 'hints.shapeGranular' },
  { key: 'shapeFibrous', label: 'hints.shapeFibrous' },
  { key: 'shapeThinFilm', label: 'hints.shapeThinFilm' },
  { key: 'shapeSolid', label: 'hints.shapeSolid' },
  { key: 'shapePowder', label: 'hints.shapePowder' },
]
const MATERIAL_ITEMS: HintItem[] = [
  { key: 'matStraw', label: 'hints.matStraw' },
  { key: 'matWood', label: 'hints.matWood' },
  { key: 'matPaper', label: 'hints.matPaper' },
  { key: 'matCookingSheet', label: 'hints.matCookingSheet' },
  { key: 'matPaint', label: 'hints.matPaint' },
  { key: 'matRubber', label: 'hints.matRubber' },
  { key: 'matCrustacean', label: 'hints.matCrustacean' },
  { key: 'matBoneShell', label: 'hints.matBoneShell' },
  { key: 'matGrain', label: 'hints.matGrain' },
]
const COLOR_ITEMS: HintItem[] = [
  { key: 'colorWhite', label: 'hints.colorWhite' },
  { key: 'colorTransparent', label: 'hints.colorTransparent' },
  { key: 'colorBlack', label: 'hints.colorBlack' },
  { key: 'colorBrown', label: 'hints.colorBrown' },
  { key: 'colorRed', label: 'hints.colorRed' },
  { key: 'colorBlue', label: 'hints.colorBlue' },
  { key: 'colorGreen', label: 'hints.colorGreen' },
  { key: 'colorMetal', label: 'hints.colorMetal' },
  { key: 'colorOther', label: 'hints.colorOther' },
]
const THREAD_ITEMS: HintItem[] = [
  { key: 'threadHair', label: 'hints.threadHair' },
  { key: 'threadSynthetic', label: 'hints.threadSynthetic' },
  { key: 'threadCotton', label: 'hints.threadCotton' },
  { key: 'threadGlove', label: 'hints.threadGlove' },
  { key: 'threadVinyl', label: 'hints.threadVinyl' },
]
const HARDNESS_ITEMS: HintItem[] = [
  { key: 'hardnessHard', label: 'hints.hardnessHard' },
  { key: 'hardnessSoft', label: 'hints.hardnessSoft' },
  { key: 'hardnessElastic', label: 'hints.hardnessElastic' },
]

const ANSWER_CYCLE: (HintAnswer | undefined)[] = [undefined, 'yes', 'no', 'unknown']

function nextAnswer(cur: HintAnswer | undefined): HintAnswer | undefined {
  const idx = ANSWER_CYCLE.indexOf(cur)
  return ANSWER_CYCLE[(idx + 1) % ANSWER_CYCLE.length]
}

const ANSWER_STYLE: Record<string, string> = {
  yes: 'bg-orange-500 text-white border-orange-500',
  no: 'bg-gray-200 text-gray-500 border-gray-300',
  unknown: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

export default function ForeignMatterHintsInput({ value, onChange }: Props) {
  const { t } = useLang()

  function toggle(key: HintKey) {
    const cur = value[key] as HintAnswer | undefined
    const next = nextAnswer(cur)
    if (next === undefined) {
      const { [key]: _, ...rest } = value
      onChange(rest as ForeignMatterHints)
    } else {
      onChange({ ...value, [key]: next })
    }
  }

  function renderGroup(title: TranslationKey, items: HintItem[]) {
    return (
      <div>
        <p className="text-[11px] font-bold text-gray-500 mb-1.5">{t(title)}</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map(({ key, label }) => {
            const ans = value[key] as HintAnswer | undefined
            const style = ans ? ANSWER_STYLE[ans] : 'bg-white text-gray-500 border-gray-200'
            const ansLabel = ans ? ` · ${t(`hints.${ans}` as TranslationKey)}` : ''
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${style}`}
              >
                {t(label)}{ansLabel}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const showThread = value.shapeFibrous === 'yes'

  return (
    <div className="card p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-700 mb-0.5">{t('hints.title')}</p>
        <p className="text-[11px] text-gray-400">{t('hints.subtitle')}</p>
      </div>
      {renderGroup('hints.shape', SHAPE_ITEMS)}
      {showThread && renderGroup('hints.thread', THREAD_ITEMS)}
      {renderGroup('hints.material', MATERIAL_ITEMS)}
      {renderGroup('hints.color', COLOR_ITEMS)}
      {renderGroup('hints.hardness', HARDNESS_ITEMS)}
    </div>
  )
}
