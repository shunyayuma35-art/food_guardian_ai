'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { listIncidents, listReports } from '@/lib/firestore'
import { DEMO_MODE } from '@/lib/firebase'
import {
  DISCOVERY_PROCESS_LABELS, CLAIM_ROUTE_LABELS, INSPECTION_RESULT_LABELS,
} from '@/lib/types'
import Navigation from '@/components/Navigation'
import IncidentCard from '@/components/IncidentCard'
import FoodEyeLogo from '@/components/FoodEyeLogo'
import UsageGuide from '@/components/UsageGuide'
import LanguageSelector from '@/components/LanguageSelector'
import type { Incident, Report, InspectionRecord } from '@/lib/types'

// ── チャートコンポーネント ─────────────────────────────────────────

const CHART_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

function DonutChart({ data }: { data: { label: string; count: number }[] }) {
  const filtered = data.filter(d => d.count > 0)
  const total = filtered.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <p className="text-xs text-gray-400 text-center py-4">データなし</p>

  const r = 42
  const cx = 60, cy = 60
  const circ = 2 * Math.PI * r
  let cumulative = 0

  return (
    <div>
      <svg viewBox="0 0 120 120" className="w-28 mx-auto block">
        {filtered.map((seg, i) => {
          const pct = seg.count / total
          const start = cumulative
          cumulative += pct
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={20}
              strokeDasharray={`${pct * circ} ${circ}`}
              strokeDashoffset={-start * circ}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#111827">{total}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill="#9ca3af">件</text>
      </svg>
      <div className="mt-3 space-y-1">
        {filtered.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-[11px] text-gray-700 flex-1 truncate">{seg.label}</span>
            <span className="text-[11px] font-bold text-gray-600">{seg.count}</span>
            <span className="text-[10px] text-gray-400">{Math.round(seg.count / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[10px] text-gray-600 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold text-gray-700 w-5 text-right">{value}</span>
    </div>
  )
}

function TrendChart({ days }: { days: { label: string; internal: number; external: number }[] }) {
  const maxVal = Math.max(...days.map(d => d.internal + d.external), 1)
  return (
    <div>
      <div className="flex items-end gap-1 h-24">
        {days.map((d, i) => {
          const total = d.internal + d.external
          const h = Math.round((total / maxVal) * 80)
          const extH = Math.round((d.external / maxVal) * 80)
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center gap-px">
              <div className="w-full flex flex-col justify-end" style={{ height: `${h}px` }}>
                <div className="w-full rounded-t-sm" style={{ height: `${extH}px`, background: '#8b5cf6', minHeight: extH > 0 ? 2 : 0 }} />
                <div className="w-full rounded-t-sm" style={{ height: `${h - extH}px`, background: '#f97316', minHeight: (h - extH) > 0 ? 2 : 0 }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] text-gray-400">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2 justify-center">
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> 社内
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> 外部
        </span>
      </div>
    </div>
  )
}

function HeatmapChart({ rows }: {
  rows: { category: string; internal: number; external: number }[]
}) {
  if (rows.length === 0) return <p className="text-xs text-gray-400 text-center py-4">データなし</p>
  const maxVal = Math.max(...rows.flatMap(r => [r.internal, r.external]), 1)

  function cellColor(v: number, type: 'internal' | 'external') {
    const alpha = Math.round((v / maxVal) * 100)
    return type === 'internal'
      ? `rgba(249,115,22,${alpha / 100})`
      : `rgba(139,92,246,${alpha / 100})`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] text-gray-400 font-semibold pb-1.5 pr-2">異物カテゴリ</th>
            <th className="text-center text-[10px] text-orange-600 font-bold pb-1.5 w-14">🏭 社内</th>
            <th className="text-center text-[10px] text-purple-600 font-bold pb-1.5 w-14">📦 外部</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <td className="text-[10px] text-gray-700 py-1 pr-2 truncate max-w-[100px]">{row.category}</td>
              <td className="text-center py-1">
                <span className="inline-block w-10 py-0.5 rounded text-[11px] font-bold text-gray-800"
                  style={{ background: cellColor(row.internal, 'internal') }}>
                  {row.internal || '—'}
                </span>
              </td>
              <td className="text-center py-1">
                <span className="inline-block w-10 py-0.5 rounded text-[11px] font-bold text-gray-800"
                  style={{ background: cellColor(row.external, 'external') }}>
                  {row.external || '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [backupList, setBackupList] = useState<{ name: string; files: string[] }[]>([])
  const [showBackup, setShowBackup] = useState(false)
  const [backupRunning, setBackupRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([
      listIncidents(user.uid),
      listReports(user.uid),
      fetch(`/api/inspections?userId=${user.uid}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([inc, rep, insp]) => {
        setIncidents(inc)
        setReports(rep)
        setInspections(Array.isArray(insp) ? insp : [])
      })
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  // 自動バックアップ（1日1回）
  useEffect(() => {
    if (!user) return
    const key = 'foodeye_last_backup'
    const todayStr = new Date().toISOString().slice(0, 10)
    const lastBackup = localStorage.getItem(key)
    if (lastBackup !== todayStr) {
      fetch('/api/backup', { method: 'POST' })
        .then((r) => {
          if (r.ok) {
            localStorage.setItem(key, todayStr)
          } else {
            console.warn('[自動バックアップ] サーバーエラー:', r.status)
          }
        })
        .catch((err) => console.warn('[自動バックアップ] 失敗:', err))
    }
  }, [user])

  async function runManualBackup() {
    setBackupRunning(true)
    try {
      await fetch('/api/backup', { method: 'POST' })
      const list = await fetch('/api/backup').then((r) => r.json())
      setBackupList(list)
      localStorage.setItem('foodeye_last_backup', new Date().toISOString().slice(0, 10))
      alert('✅ バックアップを作成しました')
    } catch {
      alert('❌ バックアップに失敗しました')
    } finally {
      setBackupRunning(false)
    }
  }

  async function loadBackupList() {
    const list = await fetch('/api/backup').then((r) => r.json()).catch(() => [])
    setBackupList(Array.isArray(list) ? list : [])
    setShowBackup(true)
  }

  async function handleRestore(name: string) {
    if (!confirm(`「${name}」のデータに復元しますか？\n現在のデータは自動バックアップされてから上書きされます。`)) return
    setRestoring(true)
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      alert('✅ 復元しました。ページを再読み込みします。')
      window.location.reload()
    } catch {
      alert('❌ 復元に失敗しました')
    } finally {
      setRestoring(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const today = new Date().toDateString()
  const openCount = incidents.filter((i) => i.status === 'open').length
  const investigatingCount = incidents.filter((i) => i.status === 'investigating').length
  const todayIncidents = incidents.filter((i) => new Date(i.createdAt).toDateString() === today).length
  const internalCount = incidents.filter(i => (i.occurrenceType ?? 'internal') === 'internal').length
  const externalCount = incidents.filter(i => i.occurrenceType === 'external').length

  // 検査統計
  const todayInsp = inspections.filter((i) => i.inspectionDate === todayStr).length
  const inspFail = inspections.filter((i) => i.result !== 'pass').length
  const totalReject = inspections.reduce((s, i) => s + (i.rejectCount || 0), 0)

  // ── 分析データ ──

  // Chart 1: 異物種類割合
  const categoryMap: Record<string, number> = {}
  incidents.forEach(inc => {
    const cat = inc.estimations?.[0]?.category || '未分類'
    categoryMap[cat] = (categoryMap[cat] || 0) + 1
  })
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))

  // Chart 2: 発生源別（internal: 工程別 / external: 経路別）
  const internalByProcess: Record<string, number> = {}
  incidents.filter(i => (i.occurrenceType ?? 'internal') === 'internal').forEach(inc => {
    const label = DISCOVERY_PROCESS_LABELS[inc.discoveryProcess] || inc.discoveryProcess
    internalByProcess[label] = (internalByProcess[label] || 0) + 1
  })
  const externalByRoute: Record<string, number> = {}
  incidents.filter(i => i.occurrenceType === 'external').forEach(inc => {
    const label = inc.claimRoute ? CLAIM_ROUTE_LABELS[inc.claimRoute] : 'その他'
    externalByRoute[label] = (externalByRoute[label] || 0) + 1
  })
  const maxProcess = Math.max(...Object.values(internalByProcess), 1)
  const maxRoute = Math.max(...Object.values(externalByRoute), 1)

  // Chart 3: ロット別推移（直近14日）
  const trendDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      dateStr: d.toDateString(),
    }
  }).map(({ label, dateStr }) => ({
    label,
    internal: incidents.filter(
      inc => new Date(inc.createdAt).toDateString() === dateStr && (inc.occurrenceType ?? 'internal') === 'internal'
    ).length,
    external: incidents.filter(
      inc => new Date(inc.createdAt).toDateString() === dateStr && inc.occurrenceType === 'external'
    ).length,
  }))

  // Chart 4: Heatmap (category × internal/external)
  const allCategories = [...new Set(incidents.map(i => i.estimations?.[0]?.category || '未分類'))]
  const heatmapRows = allCategories.map(cat => ({
    category: cat,
    internal: incidents.filter(
      i => (i.occurrenceType ?? 'internal') === 'internal' && (i.estimations?.[0]?.category || '未分類') === cat
    ).length,
    external: incidents.filter(
      i => i.occurrenceType === 'external' && (i.estimations?.[0]?.category || '未分類') === cat
    ).length,
  })).sort((a, b) => (b.internal + b.external) - (a.internal + a.external))

  return (
    <div className="min-h-screen pb-24">
      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-100 to-blue-100 rounded-2xl flex items-center justify-center shadow-md shadow-blue-100 border border-blue-200">
              <FoodEyeLogo size={32} />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-gray-800 leading-tight">FoodEye</h1>
              <p className="text-xs text-gray-500">
                {user.displayName || user.email}
                {DEMO_MODE && <span className="ml-1 text-orange-500 font-semibold">（デモ）</span>}
              </p>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

        {/* ── ヒーロー：キャラクター + ウェルカム ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-400 via-amber-400 to-rose-400 rounded-3xl shadow-lg shadow-orange-200">
          {/* 背景デコ */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-rose-300/20 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center pt-7 pb-6 px-5">
            {/* キャラクター */}
            <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-300 border-4 border-white mb-4">
              <FoodEyeLogo size={88} />
            </div>
            <h2 className="text-white text-2xl font-extrabold leading-tight tracking-tight">FoodEye</h2>
            <p className="text-white/85 text-sm font-medium mt-1">{t('home.subtitle')}</p>
            <p className="text-white/70 text-xs mt-1.5">{t('home.tagline')}</p>
            {(internalCount > 0 || externalCount > 0) && (
              <div className="mt-3 flex gap-2">
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  🏭 社内 {internalCount}件
                </span>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  📦 外部 {externalCount}件
                </span>
              </div>
            )}
          </div>
        </div>

        {/* システム使い方ガイド */}
        <UsageGuide
          title="📖 FoodEye 使い方・操作手順"
          color="orange"
          steps={[
            { icon: '⚙️', title: 'まず「マスターデータ」を設定する', desc: '担当者名・製品名・検査機器名を登録しておくと、各画面で選択式になり入力が速くなります。初回利用時に必ず設定してください。' },
            { icon: '📷', title: '異物を発見したら「新規 異物登録」', desc: '工場内発見・お客様クレームどちらも登録できます。写真を撮影し、異物の特徴（触感・色・においなど）を選択するとAIが種類を自動推定します。' },
            { icon: '🧲', title: '毎日「検査記録を登録」する', desc: '金属探知機・X線検査機のテストピース確認結果を記録します。始業・終業の合否チェックと排除件数を入力してください。' },
            { icon: '📊', title: '「月次・年次レポート」で傾向を確認', desc: '期間を選んで集計グラフを確認できます。監査・品質会議の資料として印刷もできます。' },
          ]}
          tips={[
            '登録したデータはサーバーPCに自動保存されます（1日1回自動バックアップ）',
            'QRコードを印刷して壁に貼ると、スマホからすぐアクセスできます',
            '同じWi-Fiに接続した全端末でデータを共有できます',
          ]}
        />

        {/* 統計カード */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">異物事故</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: todayIncidents, label: t('home.stats.today'), color: 'text-red-500', bg: 'bg-red-50' },
              { value: openCount + investigatingCount, label: t('home.stats.active'), color: 'text-orange-500', bg: 'bg-orange-50' },
              { value: incidents.length, label: t('home.stats.total'), color: 'text-gray-800', bg: 'bg-white' },
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl border border-orange-100 shadow-sm p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>

        </div>

        {/* 検査記録統計 */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">検査記録（金属探知・X線）</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { value: todayInsp, label: t('home.stats.todayInsp'), color: 'text-teal-600', bg: 'bg-teal-50' },
              { value: inspFail, label: t('home.stats.fail'), color: 'text-red-500', bg: 'bg-red-50' },
              { value: totalReject, label: t('home.stats.rejected'), color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl border border-teal-100 shadow-sm p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* クイックアクション */}
        <div>
          <p className="section-title">クイックアクション</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/record">
              <div className="card p-4 flex flex-col items-center gap-2 hover:shadow-[0_4px_24px_rgba(251,146,60,0.18)] hover:border-orange-200 transition-all active:scale-[0.98] cursor-pointer">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-rose-400 rounded-2xl flex items-center justify-center text-3xl shadow-md shadow-orange-200">📷</div>
                <span className="text-sm font-bold text-gray-800">{t('home.quick.recordTitle')}</span>
                <span className="text-xs text-gray-500 text-center leading-relaxed">{t('home.quick.recordDesc')}</span>
              </div>
            </Link>
            <Link href="/inspection/new">
              <div className="card p-4 flex flex-col items-center gap-2 hover:shadow-[0_4px_24px_rgba(20,184,166,0.18)] hover:border-teal-200 transition-all active:scale-[0.98] cursor-pointer">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl shadow-md shadow-teal-200">🧲</div>
                <span className="text-sm font-bold text-gray-800">{t('home.quick.inspTitle')}</span>
                <span className="text-xs text-gray-500 text-center leading-relaxed">{t('home.quick.inspDesc')}</span>
              </div>
            </Link>
            <Link href="/list">
              <div className="card p-4 flex flex-col items-center gap-2 hover:shadow-[0_4px_24px_rgba(251,146,60,0.12)] hover:border-orange-200 transition-all active:scale-[0.98] cursor-pointer">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl flex items-center justify-center text-3xl shadow-md shadow-amber-200">📋</div>
                <span className="text-sm font-bold text-gray-800">{t('home.quick.listTitle')}</span>
                <span className="text-xs text-gray-500 text-center leading-relaxed">{t('home.quick.listDesc')}</span>
              </div>
            </Link>
            <Link href="/inspection">
              <div className="card p-4 flex flex-col items-center gap-2 hover:shadow-[0_4px_24px_rgba(20,184,166,0.12)] hover:border-teal-200 transition-all active:scale-[0.98] cursor-pointer">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl flex items-center justify-center text-3xl shadow-md shadow-cyan-200">📊</div>
                <span className="text-sm font-bold text-gray-800">{t('home.quick.inspListTitle')}</span>
                <span className="text-xs text-gray-500 text-center leading-relaxed">{t('home.quick.inspListDesc')}</span>
              </div>
            </Link>
          </div>
        </div>

        {/* バックアップ管理 */}
        <div>
          <button
            onClick={loadBackupList}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-base font-extrabold">
              💾 バックアップ管理
            </span>
            <span className="text-lg">{showBackup ? '▲' : '▼'}</span>
          </button>
          {showBackup && (
            <div className="mt-3 card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold">保存先: data/backups/ （最大30世代）</p>
                <button onClick={runManualBackup} disabled={backupRunning}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 hover:bg-blue-600 transition-all">
                  {backupRunning ? '作成中...' : '今すぐバックアップ'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">✅ 自動バックアップ: 1日1回（アプリ起動時）</p>
              {backupList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">バックアップなし</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {backupList.map((b) => (
                    <div key={b.name} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="text-xs font-bold text-gray-700">{b.name}</p>
                        <p className="text-[10px] text-gray-400">{b.files.join(' / ')}</p>
                      </div>
                      <button onClick={() => handleRestore(b.name)} disabled={restoring}
                        className="text-xs text-blue-600 font-bold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-all">
                        復元
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ツールリンク ── */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/report/monthly">
            <div className="card p-3 flex items-center gap-2 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-xs font-bold text-gray-800">月次・年次レポート</p>
                <p className="text-[10px] text-gray-400">傾向分析・審査用印刷</p>
              </div>
            </div>
          </Link>
          <Link href="/master">
            <div className="card p-3 flex items-center gap-2 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer">
              <span className="text-2xl">⚙️</span>
              <div>
                <p className="text-xs font-bold text-gray-800">マスターデータ</p>
                <p className="text-[10px] text-gray-400">担当者・製品・機器登録</p>
              </div>
            </div>
          </Link>
        </div>

        {/* ━━ 分析ダッシュボード ━━ */}
        <div>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-base font-extrabold">
              📊 統合分析ダッシュボード
            </span>
            <span className="text-lg">{showAnalytics ? '▲' : '▼'}</span>
          </button>

          {showAnalytics && (
            <div className="mt-3 space-y-4">
              {incidents.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-400 text-sm">異物登録データがありません</p>
                </div>
              ) : (
                <>
                  {/* Chart 1: 異物種類の割合 */}
                  <div className="card p-4">
                    <p className="text-xs font-bold text-gray-500 mb-3">
                      🥧 異物種類の割合
                      <span className="ml-1 font-normal text-gray-400">（社内 + 外部クレーム合計）</span>
                    </p>
                    <DonutChart data={categoryData} />
                  </div>

                  {/* Chart 2: 発生源別棒グラフ */}
                  <div className="card p-4">
                    <p className="text-xs font-bold text-gray-500 mb-3">📊 発生源別 異物分布</p>
                    <div className="space-y-4">
                      {internalCount > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-orange-600 mb-2">🏭 社内発見 — 工程別</p>
                          {Object.entries(internalByProcess).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                            <HBar key={label} label={label} value={count} max={maxProcess} color="#f97316" />
                          ))}
                        </div>
                      )}
                      {externalCount > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-purple-600 mb-2">📦 外部クレーム — 経路別</p>
                          {Object.entries(externalByRoute).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                            <HBar key={label} label={label} value={count} max={maxRoute} color="#8b5cf6" />
                          ))}
                          {Object.keys(externalByRoute).length === 0 && (
                            <p className="text-[11px] text-gray-400">クレーム経路データなし</p>
                          )}
                        </div>
                      )}
                      {externalCount === 0 && (
                        <p className="text-[11px] text-gray-400 text-center py-2">外部クレームの登録データがありません</p>
                      )}
                    </div>
                  </div>

                  {/* Chart 3: ロット別異物推移（直近14日） */}
                  <div className="card p-4">
                    <p className="text-xs font-bold text-gray-500 mb-3">
                      📈 異物推移
                      <span className="ml-1 font-normal text-gray-400">（直近14日間）</span>
                    </p>
                    <TrendChart days={trendDays} />
                  </div>

                  {/* Chart 4: Internal vs External ヒートマップ */}
                  <div className="card p-4">
                    <p className="text-xs font-bold text-gray-500 mb-1">🔥 社内 vs 外部 — 異物カテゴリ一致率</p>
                    <p className="text-[10px] text-gray-400 mb-3">同カテゴリが内外に出現する場合、製造起因の可能性があります</p>
                    <HeatmapChart rows={heatmapRows} />
                    {heatmapRows.filter(r => r.internal > 0 && r.external > 0).length > 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                        <p className="text-[11px] font-bold text-amber-700">⚠️ 一致カテゴリ検出</p>
                        <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed">
                          {heatmapRows.filter(r => r.internal > 0 && r.external > 0).map(r => r.category).join('、')} が社内・外部の両方に存在します。製造工程の精査を推奨します。
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 報告書フォルダ */}
        {reports.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="section-title mb-0">📁 報告書フォルダ</p>
              <Link href={`/report/${reports[0].id}`} className="text-xs text-blue-500 hover:text-blue-600 font-semibold">
                すべて見る →
              </Link>
            </div>
            <div className="space-y-2">
              {reports.slice(0, 3).map((r) => (
                <Link key={r.id} href={`/report/${r.id}`}>
                  <div className="card px-4 py-3 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.98]">
                    <span className="text-2xl">{r.type === 'incident' ? '📄' : '🔬'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleDateString('ja-JP')} 生成
                      </p>
                    </div>
                    <span className="text-gray-300 text-lg shrink-0">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-3.5">
          <p className="text-yellow-600 text-xs font-bold">⚠️ {t('home.stats.fail') === '異常・調整' ? 'ご利用上の注意' : 'Notice'}</p>
          <p className="text-gray-600 text-xs mt-1 leading-relaxed">{t('home.notice')}</p>
        </div>

        {/* 最近の異物記録 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('home.recent')}</p>
            <Link href="/list" className="text-xs text-orange-500 hover:text-orange-600 font-semibold">
              {t('home.viewAll')}
            </Link>
          </div>

          {fetching ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-3">📝</div>
              <p className="text-gray-500 text-sm font-medium">{t('home.noData')}</p>
              <Link href="/record">
                <button className="btn-primary mt-5 text-sm px-6 py-2.5">
                  {t('home.firstRecord')}
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 3).map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </div>

        {/* SNS リンク */}
        <div className="flex items-center justify-center gap-3 py-2 flex-wrap">
          <a
            href="https://foodguardianai.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 transition-colors font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 17.93V18a1 1 0 0 0-1-1H8a3 3 0 0 1-3-3v-1l5 5v-.07zm6.9-2.54A8 8 0 0 1 13 19.93V18a3 3 0 0 0-3-3H8v-1a1 1 0 0 0-1-1H5.07A8 8 0 0 1 12 4a8 8 0 0 1 8 8 7.95 7.95 0 0 1-2.1 5.39z" />
            </svg>
            Web版
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="https://x.com/hapifoodlab"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @hapifoodlab
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="https://note.com/hapifoodlab"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 transition-colors font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M2 5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5zm10.5 1.5a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4zm-5 4a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2h-9zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6z" />
            </svg>
            note
          </a>
        </div>

      </div>

      <Navigation />
    </div>
  )
}
