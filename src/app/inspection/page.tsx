'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import { DEVICE_TYPE_LABELS, INSPECTION_RESULT_LABELS, type InspectionRecord, type DeviceType } from '@/lib/types'
import { listInspections } from '@/lib/firestore'

const RESULT_BADGE: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-600',
  adjusted: 'bg-amber-100 text-amber-700',
}

export default function InspectionListPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all')
  const [filterResult, setFilterResult] = useState<string>('all')
  const [searchDate, setSearchDate] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    listInspections(user.uid)
      .then((data) => setRecords(data))
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  const filtered = records.filter((r) => {
    if (filterType !== 'all' && r.deviceType !== filterType) return false
    if (filterResult !== 'all' && r.result !== filterResult) return false
    if (searchDate && r.inspectionDate !== searchDate) return false
    return true
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCount = records.filter((r) => r.inspectionDate === todayStr).length
  const failCount = records.filter((r) => r.result !== 'pass').length
  const totalReject = records.reduce((s, r) => s + (r.rejectCount || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-white/85 backdrop-blur-xl border-b border-teal-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="back-btn">←</button>
          <h1 className="font-extrabold text-gray-800 text-base">{t('insp.title')}</h1>
          <Link href="/inspection/new">
            <button className="px-3 py-1.5 bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm shadow-teal-200 hover:bg-teal-600 transition-all">
              ＋ {t('common.new')}
            </button>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">
        <UsageGuide
          title="📖 検査記録一覧の使い方"
          color="teal"
          steps={[
            { icon: '➕', title: `「＋ ${t('common.new')}」で検査記録を登録`, desc: '右上の「＋ 新規」ボタンから、金属探知機・X線検査機の記録を登録します。' },
            { icon: '🔍', title: 'フィルターで絞り込む', desc: '機種・結果・日付で絞り込みができます。' },
            { icon: '📋', title: 'カードをタップして詳細・出力', desc: '各カードをタップすると詳細画面が開きます。' },
          ]}
          tips={[
            '上部の統計カードで今日の検査件数・異常件数・累計排除件数を確認できます',
          ]}
        />

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: todayCount, label: t('home.stats.todayInsp'), color: 'text-teal-600', bg: 'bg-teal-50' },
            { value: failCount, label: t('home.stats.fail'), color: 'text-red-500', bg: 'bg-red-50' },
            { value: totalReject, label: t('insp.totalReject'), color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ value, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-teal-100 p-3 text-center`}>
              <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* フィルター */}
        <div className="card p-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'metal_detector', 'xray'] as const).map((type) => (
              <button key={type} onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filterType === type
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'
                }`}
              >
                {type === 'all' ? t('insp.allDevices') : DEVICE_TYPE_LABELS[type]}
              </button>
            ))}
            {(['all', 'pass', 'fail', 'adjusted'] as const).map((r) => (
              <button key={r} onClick={() => setFilterResult(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filterResult === r
                    ? 'bg-gray-700 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {r === 'all' ? t('insp.allResults') : INSPECTION_RESULT_LABELS[r]}
              </button>
            ))}
          </div>
          <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
            className="input-field text-sm" />
        </div>

        {/* 一覧 */}
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm font-medium">{t('insp.noRecords')}</p>
            <Link href="/inspection/new">
              <button className="mt-4 px-5 py-2.5 bg-teal-500 text-white text-sm font-bold rounded-2xl shadow-md shadow-teal-200">
                {t('insp.firstRecord')}
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((rec) => (
              <Link key={rec.id} href={`/inspection/${rec.id}`}>
                <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer">
                  <span className="text-2xl shrink-0">
                    {rec.deviceType === 'metal_detector' ? '🧲' : '☢️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-gray-800 truncate">{rec.deviceName}</p>
                      {rec.lineNumber && (
                        <span className="text-[10px] text-gray-400 shrink-0">{rec.lineNumber}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {rec.productName || t('insp.noProductName')}{rec.lotNumber ? ` · ${rec.lotNumber}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">{rec.inspectionDate} · {rec.inspector}</p>
                    {rec.rejectCount > 0 && (
                      <p className="text-xs text-red-500 font-semibold mt-0.5">{t('insp.rejected')} {rec.rejectCount}{t('insp.unit')}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RESULT_BADGE[rec.result]}`}>
                      {INSPECTION_RESULT_LABELS[rec.result]}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {rec.startCheck.passed ? '✅始' : '❌始'} {rec.endCheck.passed ? '✅終' : '❌終'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  )
}
