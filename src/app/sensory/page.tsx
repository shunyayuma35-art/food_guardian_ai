'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { listSensoryEvaluations } from '@/lib/firestore'
import { SENSORY_JUDGEMENT_LABELS } from '@/lib/types'
import Navigation from '@/components/Navigation'
import type { SensoryEvaluation, SensoryJudgement } from '@/lib/types'

const JUDGEMENT_STYLE: Record<SensoryJudgement, { bg: string; text: string; badge: string }> = {
  pass:    { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  fail:    { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   badge: 'bg-red-100 text-red-700' },
}

const JUDGEMENT_ICON: Record<SensoryJudgement, string> = {
  pass: '✅', warning: '⚠️', fail: '❌',
}

function EvalCard({ ev, onClick }: { ev: SensoryEvaluation; onClick: () => void }) {
  const { t } = useLang()
  const style = JUDGEMENT_STYLE[ev.judgement]
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border ${style.bg} transition-all active:scale-[0.98] shadow-sm hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{JUDGEMENT_ICON[ev.judgement]}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
              {SENSORY_JUDGEMENT_LABELS[ev.judgement]}
            </span>
            {ev.approvedAt && (
              <span className="text-xs text-gray-400 font-medium">{t('sensory.approvedBadge')}</span>
            )}
          </div>
          <p className="font-bold text-gray-800 text-sm truncate">{ev.productName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('sensory.lot')} {ev.lotNumber}
            {ev.inspectorName && ` · ${t('sensory.inspector')} ${ev.inspectorName}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400 font-medium">
            {new Date(ev.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
          </p>
          <span className="text-gray-300 text-lg">›</span>
        </div>
      </div>
    </button>
  )
}

export default function SensoryListPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<SensoryEvaluation[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [filterJudgement, setFilterJudgement] = useState<SensoryJudgement | ''>('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    listSensoryEvaluations(user.uid)
      .then(setEvaluations)
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  const filtered = useMemo(() => {
    return evaluations.filter((ev) => {
      const q = search.toLowerCase()
      if (q && !ev.productName.toLowerCase().includes(q) && !ev.lotNumber.toLowerCase().includes(q)) return false
      if (filterJudgement && ev.judgement !== filterJudgement) return false
      return true
    })
  }, [evaluations, search, filterJudgement])

  const todayCount = evaluations.filter((ev) => {
    const d = new Date(ev.date)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  const passCount = evaluations.filter((ev) => ev.judgement === 'pass').length
  const warnCount = evaluations.filter((ev) => ev.judgement === 'warning').length
  const failCount = evaluations.filter((ev) => ev.judgement === 'fail').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-blue-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/')} className="back-btn shrink-0">←</button>
            <div className="flex-1">
              <h1 className="font-extrabold text-gray-800 text-lg leading-tight">{t('sensory.title')}</h1>
              <p className="text-xs text-gray-500">{t('sensory.totalCount').replace('{n}', String(evaluations.length))}</p>
            </div>
            <button
              onClick={() => router.push('/sensory/new')}
              className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded-xl transition-all shadow-md shadow-blue-200"
            >
              {t('sensory.newBtn')}
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field text-sm mb-2"
            placeholder={t('sensory.searchPlaceholder')}
          />

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <select
              value={filterJudgement}
              onChange={(e) => setFilterJudgement(e.target.value as SensoryJudgement | '')}
              className="text-xs bg-white border border-blue-200 text-gray-600 rounded-xl px-3 py-2 shrink-0 focus:border-blue-400 focus:outline-none font-medium"
            >
              <option value="">{t('sensory.filterAll')}</option>
              <option value="pass">{t('sensory.filterPass')}</option>
              <option value="warning">{t('sensory.filterWarn')}</option>
              <option value="fail">{t('sensory.filterFail')}</option>
            </select>
            {(search || filterJudgement) && (
              <button
                onClick={() => { setSearch(''); setFilterJudgement('') }}
                className="text-xs text-blue-500 hover:text-blue-600 font-bold px-2 py-2 shrink-0"
              >
                {t('sensory.clearFilter')}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-4 space-y-4">
        {/* 統計 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: todayCount, label: t('sensory.statsToday'), color: 'text-blue-600', bg: 'bg-blue-50' },
            { value: passCount, label: t('sensory.statsPass'), color: 'text-green-600', bg: 'bg-green-50' },
            { value: warnCount, label: t('sensory.statsWarn'), color: 'text-amber-600', bg: 'bg-amber-50' },
            { value: failCount, label: t('sensory.statsFail'), color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ value, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-gray-100 p-3 text-center`}>
              <p className={`text-xl font-extrabold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* リスト */}
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔬</div>
            <p className="text-gray-500 font-medium text-base">
              {evaluations.length === 0 ? t('sensory.noRecords') : t('sensory.noMatch')}
            </p>
            {evaluations.length === 0 && (
              <button
                onClick={() => router.push('/sensory/new')}
                className="mt-5 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-200 transition-all"
              >
                {t('sensory.firstRecord')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ev) => (
              <EvalCard
                key={ev.id}
                ev={ev}
                onClick={() => router.push(`/sensory/${ev.id}`)}
              />
            ))}
            <p className="text-xs text-gray-400 text-center pt-2 font-medium">
              {t('sensory.showingCount').replace('{n}', String(filtered.length))}
              {filtered.length !== evaluations.length && `（${t('sensory.totalCount').replace('{n}', String(evaluations.length))}）`}
            </p>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  )
}
