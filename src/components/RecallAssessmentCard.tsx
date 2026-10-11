'use client'

import { useLang } from '@/context/LanguageContext'
import type { RecallAssessment, TriAnswer, RecallLevel } from '@/lib/types'
import { calcRecallLevel } from '@/lib/types'
import type { TranslationKey } from '@/lib/i18n'

interface Props {
  value: RecallAssessment
  onChange: (v: RecallAssessment) => void
  onSave?: () => void
  saving?: boolean
}

const QUESTIONS: { key: keyof RecallAssessment; label: TranslationKey }[] = [
  { key: 'q1_hazardous', label: 'recall.q1' },
  { key: 'q2_sharpHard', label: 'recall.q2' },
  { key: 'q3_healthClaim', label: 'recall.q3' },
  { key: 'q4_multipleInLot', label: 'recall.q4' },
  { key: 'q5_processOrigin', label: 'recall.q5' },
  { key: 'q6_inMarket', label: 'recall.q6' },
]

const ANSWERS: TriAnswer[] = ['yes', 'no', 'unknown']

const ANSWER_STYLE: Record<TriAnswer, string> = {
  yes: 'bg-orange-500 text-white border-orange-500',
  no: 'bg-gray-100 text-gray-500 border-gray-200',
  unknown: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

const LEVEL_STYLE: Record<RecallLevel, string> = {
  recall: 'bg-red-50 border-red-300 text-red-700',
  consult: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  internal: 'bg-green-50 border-green-300 text-green-700',
}

export default function RecallAssessmentCard({ value, onChange, onSave, saving }: Props) {
  const { t } = useLang()

  const allAnswered = QUESTIONS.every(q => value[q.key] !== null)
  const level: RecallLevel | null = allAnswered ? calcRecallLevel(value) : null

  function setAnswer(key: keyof RecallAssessment, ans: TriAnswer) {
    onChange({ ...value, [key]: ans })
  }

  return (
    <div className="card p-4 space-y-4">
      <p className="section-title">{t('recall.title')}</p>

      <div className="space-y-3">
        {QUESTIONS.map(({ key, label }, i) => (
          <div key={key}>
            <p className="text-xs text-gray-700 mb-1.5">
              <span className="font-bold text-orange-500 mr-1">{i + 1}.</span>
              {t(label)}
            </p>
            <div className="flex gap-2">
              {ANSWERS.map(ans => (
                <button
                  key={ans}
                  type="button"
                  onClick={() => setAnswer(key, ans)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                    value[key] === ans ? ANSWER_STYLE[ans] : 'bg-white text-gray-400 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {t(`recall.${ans}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 判定結果 */}
      {level && (
        <div className={`rounded-xl border px-4 py-3 ${LEVEL_STYLE[level]}`}>
          <p className="font-extrabold text-sm">{t(`recall.level.${level}` as TranslationKey)}</p>
        </div>
      )}

      {/* 流通警告 */}
      {value.q6_inMarket === 'yes' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <p className="text-xs text-red-700">{t('recall.marketWarning')}</p>
        </div>
      )}

      {/* 免責 */}
      <p className="text-[10px] text-gray-400 leading-relaxed">{t('recall.disclaimer')}</p>

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? '...' : t('recall.save')}
        </button>
      )}
    </div>
  )
}
