'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import { listIncidents, listInspections } from '@/lib/firestore'
import { DISCOVERY_PROCESS_LABELS, INSPECTION_RESULT_LABELS } from '@/lib/types'
import type { Incident, InspectionRecord } from '@/lib/types'

function pad(n: number) { return String(n).padStart(2, '0') }

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right">{count}</span>
    </div>
  )
}

export default function MonthlyReportPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [fetching, setFetching] = useState(true)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [mode, setMode] = useState<'month' | 'year'>('month')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      listIncidents(user.uid),
      listInspections(user.uid),
    ])
      .then(([inc, insp]) => {
        if (cancelled) return
        setIncidents(inc)
        setInspections(insp)
      })
      .catch((e) => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [user])

  const prefix = mode === 'month' ? `${year}-${pad(month)}` : `${year}`

  const filteredInc = useMemo(() =>
    incidents.filter((i) => i.createdAt.startsWith(prefix)),
    [incidents, prefix])

  const filteredInsp = useMemo(() =>
    inspections.filter((i) => i.inspectionDate.startsWith(prefix)),
    [inspections, prefix])

  // 異物種別集計
  const categoryCount = useMemo(() => {
    const map: Record<string, number> = {}
    filteredInc.forEach((i) => {
      const cat = i.estimations?.[0]?.category ?? '未分類'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredInc])

  // 発見工程別集計
  const processCount = useMemo(() => {
    const map: Record<string, number> = {}
    filteredInc.forEach((i) => {
      const label = DISCOVERY_PROCESS_LABELS[i.discoveryProcess] ?? i.discoveryProcess
      map[label] = (map[label] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredInc])

  // 月別推移（年モード時）
  const monthlyTrend = useMemo(() => {
    if (mode !== 'year') return []
    return Array.from({ length: 12 }, (_, i) => {
      const m = pad(i + 1)
      const key = `${year}-${m}`
      return {
        label: `${i + 1}月`,
        count: incidents.filter((inc) => inc.createdAt.startsWith(key)).length,
      }
    })
  }, [incidents, year, mode])

  const maxMonthly = Math.max(...monthlyTrend.map((m) => m.count), 1)

  // 検査記録集計
  const inspPass = filteredInsp.filter((i) => i.result === 'pass').length
  const inspFail = filteredInsp.filter((i) => i.result === 'fail').length
  const inspAdj = filteredInsp.filter((i) => i.result === 'adjusted').length
  const totalReject = filteredInsp.reduce((s, i) => s + (i.rejectCount || 0), 0)

  const periodLabel = mode === 'month'
    ? `${year}年${month}月`
    : `${year}年（年次）`

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="back-btn">←</button>
          <h1 className="font-extrabold text-gray-800 text-base">📊 月次・年次レポート</h1>
          <button onClick={() => window.print()}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:border-orange-300 hover:text-orange-500 transition-all">
            🖨️ 印刷
          </button>
        </div>
      </header>

      {/* 印刷用ヘッダー */}
      <div className="hidden print:block p-6 border-b">
        <h1 className="text-2xl font-bold">食品安全 集計レポート — {periodLabel}</h1>
        <p className="text-sm text-gray-500">発行: {new Date().toLocaleString('ja-JP')}</p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
        {/* 使い方ガイド */}
        <UsageGuide
          title="📖 月次・年次レポートの使い方"
          color="indigo"
          steps={[
            { icon: '📅', title: '期間を選ぶ（月次 or 年次）', desc: '「月次」を選ぶと特定の月の集計、「年次」を選ぶと年間の月別推移グラフが表示されます。' },
            { icon: '📊', title: '集計結果を確認する', desc: '異物事故の件数・種別・発見工程、検査記録の正常/異常件数・排除件数が自動集計されます。' },
            { icon: '🖨️', title: '印刷してPDF保存', desc: '右上の「🖨️ 印刷」ボタンから印刷できます。印刷時に「PDFで保存」を選ぶとPDFファイルとして保存できます。' },
          ]}
          tips={[
            '毎月の品質会議・食品安全チーム会議の資料として活用できます',
            'FSSC22000・SQF・JFSなどの審査で「傾向分析の記録」として提出できます',
            '年次レポートの月別推移グラフで「発生が多い季節・時期」を把握できます',
          ]}
        />

        {/* 期間セレクター */}
        <div className="card p-4 no-print">
          <div className="flex gap-2 mb-3">
            {(['month', 'year'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                  mode === m ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'
                }`}>
                {m === 'month' ? '月次' : '年次'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="input-field flex-1">
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            {mode === 'month' && (
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="input-field flex-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 期間タイトル */}
        <div className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-200">
          <p className="text-xs font-semibold opacity-80">集計期間</p>
          <p className="text-2xl font-extrabold">{periodLabel}</p>
          <div className="flex gap-4 mt-2 text-sm font-semibold">
            <span>異物事故 {filteredInc.length}件</span>
            <span>検査記録 {filteredInsp.length}件</span>
          </div>
        </div>

        {/* 異物事故サマリー */}
        <div className="card p-4">
          <p className="section-title">🚨 異物事故サマリー</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { value: filteredInc.length, label: '総件数', color: 'text-orange-500', bg: 'bg-orange-50' },
              { value: filteredInc.filter((i) => i.status === 'open').length, label: '未処理', color: 'text-red-500', bg: 'bg-red-50' },
              { value: filteredInc.filter((i) => i.status === 'closed').length, label: '完了', color: 'text-green-600', bg: 'bg-green-50' },
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="bg-blue-50 rounded-xl p-2">
              <p className="text-lg font-extrabold text-blue-600">
                {filteredInc.filter((i) => (i.occurrenceType ?? 'internal') === 'internal').length}
              </p>
              <p className="text-xs text-gray-500">社内発見</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-2">
              <p className="text-lg font-extrabold text-purple-600">
                {filteredInc.filter((i) => i.occurrenceType === 'external').length}
              </p>
              <p className="text-xs text-gray-500">外部クレーム</p>
            </div>
          </div>
        </div>

        {/* 異物種別ランキング */}
        {categoryCount.length > 0 && (
          <div className="card p-4">
            <p className="section-title">🔍 異物種別ランキング</p>
            {categoryCount.slice(0, 8).map(([label, count]) => (
              <BarRow key={label} label={label} count={count}
                max={categoryCount[0][1]} color="bg-orange-400" />
            ))}
          </div>
        )}

        {/* 発見工程別 */}
        {processCount.length > 0 && (
          <div className="card p-4">
            <p className="section-title">🏭 発見工程別</p>
            {processCount.map(([label, count]) => (
              <BarRow key={label} label={label} count={count}
                max={processCount[0][1]} color="bg-amber-400" />
            ))}
          </div>
        )}

        {/* 月別推移（年次モード） */}
        {mode === 'year' && (
          <div className="card p-4">
            <p className="section-title">📈 月別推移（{year}年）</p>
            {monthlyTrend.map(({ label, count }) => (
              <BarRow key={label} label={label} count={count} max={maxMonthly} color="bg-rose-400" />
            ))}
          </div>
        )}

        {/* 検査記録サマリー */}
        <div className="card p-4">
          <p className="section-title">🧲 検査記録サマリー（金属探知・X線）</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { value: filteredInsp.length, label: '総検査件数', color: 'text-teal-600', bg: 'bg-teal-50' },
              { value: totalReject, label: '排除件数', color: 'text-red-500', bg: 'bg-red-50' },
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <BarRow label="正常" count={inspPass} max={filteredInsp.length} color="bg-green-400" />
            <BarRow label="異常" count={inspFail} max={filteredInsp.length} color="bg-red-400" />
            <BarRow label="調整後OK" count={inspAdj} max={filteredInsp.length} color="bg-amber-400" />
          </div>
          {filteredInsp.length > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-right">
              異常率: {Math.round(((inspFail + inspAdj) / filteredInsp.length) * 100)}%
            </p>
          )}
        </div>

        {filteredInc.length === 0 && filteredInsp.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 text-sm">この期間のデータがありません</p>
          </div>
        )}
      </div>

      <Navigation />

      <style jsx global>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
