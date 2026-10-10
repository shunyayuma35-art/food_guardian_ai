'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { listIncidents } from '@/lib/firestore'
import { PDCA_STATUS_LABELS, PDCA_STATUS_COLORS, type PdcaStatus } from '@/lib/types'
import Navigation from '@/components/Navigation'
import type { Incident } from '@/lib/types'

const PDCA_ALL = ['planned', 'doing', 'checking', 'done'] as PdcaStatus[]

function getBestCorrective(inc: Incident): string {
  return inc.editedCorrective ?? inc.aiCorrectiveRaw ?? inc.correctiveAction ?? ''
}
function getBestPreventive(inc: Incident): string {
  return inc.editedPreventive ?? inc.aiPreventiveRaw ?? inc.preventiveMeasure ?? ''
}

function summarize(text: string, maxLen = 40): string {
  if (!text) return '—'
  const first = text.split(/\n/)[0].replace(/^[・\-\d.）)]\s*/, '').trim()
  return first.length > maxLen ? first.slice(0, maxLen) + '…' : first
}

function toCSV(rows: Incident[]): string {
  const header = ['発見日', '商品名', '異物種別', '是正処置(要約)', '再発防止(要約)', 'PDCA状態', '最終更新者', '最終更新日']
  const lines = [header.join(',')]
  for (const inc of rows) {
    const pdca = inc.pdcaStatus ? PDCA_STATUS_LABELS[inc.pdcaStatus].replace(/[^a-zA-Zぁ-んぁ-龯]/g, '') : ''
    const updatedAt = inc.actionsUpdatedAt
      ? new Date(inc.actionsUpdatedAt).toLocaleDateString('ja-JP')
      : inc.causeVerifiedAt
        ? new Date(inc.causeVerifiedAt).toLocaleDateString('ja-JP')
        : ''
    const updatedBy = inc.actionsUpdatedBy ?? inc.causeVerifiedBy ?? ''
    const cols = [
      inc.discoveryDate?.slice(0, 10) ?? '',
      inc.productName ?? '',
      inc.estimations?.[0]?.category ?? '',
      summarize(getBestCorrective(inc), 60),
      summarize(getBestPreventive(inc), 60),
      pdca,
      updatedBy,
      updatedAt,
    ]
    lines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  }
  return lines.join('\r\n')
}

export default function ActionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [fetching, setFetching] = useState(true)
  const [filterPdca, setFilterPdca] = useState<PdcaStatus | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [lang, setLang] = useState('ja')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLang(localStorage.getItem('foodeye_lang') ?? 'ja')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    listIncidents(user.uid)
      .then(data => setIncidents(data.sort((a, b) => (b.discoveryDate ?? '').localeCompare(a.discoveryDate ?? ''))))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [user])

  const isEn = lang === 'en'

  // 異物カテゴリの選択肢
  const categories = useMemo(() => {
    const cats = new Set<string>()
    incidents.forEach(inc => {
      if (inc.estimations?.[0]?.category) cats.add(inc.estimations[0].category)
    })
    return Array.from(cats).sort()
  }, [incidents])

  // フィルタ適用
  const filtered = useMemo(() => {
    return incidents.filter(inc => {
      if (filterPdca !== 'all' && inc.pdcaStatus !== filterPdca) return false
      if (filterCategory && inc.estimations?.[0]?.category !== filterCategory) return false
      const d = inc.discoveryDate?.slice(0, 10) ?? ''
      if (filterDateFrom && d < filterDateFrom) return false
      if (filterDateTo && d > filterDateTo) return false
      return true
    })
  }, [incidents, filterPdca, filterCategory, filterDateFrom, filterDateTo])

  // 同種異物の過去件数
  const categoryCount = useMemo(() => {
    const map = new Map<string, number>()
    incidents.forEach(inc => {
      const cat = inc.estimations?.[0]?.category
      if (cat) map.set(cat, (map.get(cat) ?? 0) + 1)
    })
    return map
  }, [incidents])

  function handleCSV() {
    const csv = toCSV(filtered)
    const bom = '﻿'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `是正再発防止一覧_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fafafa' }}>
      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/list')} className="back-btn" aria-label="戻る">←</button>
          <div>
            <h1 className="text-base font-extrabold text-gray-800">
              {isEn ? '🔄 Corrective Action Review' : '🔄 是正・再発防止 振り返り'}
            </h1>
            <p className="text-[11px] text-gray-400 text-center">{filtered.length} / {incidents.length} 件</p>
          </div>
          <button
            onClick={handleCSV}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all active:scale-95"
          >
            📊 CSV
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* フィルタ */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">{isEn ? 'Filter' : '絞り込み'}</p>

          {/* PDCAステータス */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterPdca('all')}
              className={`text-[11px] px-3 py-1 rounded-full font-bold border transition-all ${
                filterPdca === 'all' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {isEn ? 'All' : 'すべて'}
            </button>
            {PDCA_ALL.map(s => (
              <button key={s} onClick={() => setFilterPdca(s === filterPdca ? 'all' : s)}
                className={`text-[11px] px-3 py-1 rounded-full font-bold border transition-all ${
                  filterPdca === s ? PDCA_STATUS_COLORS[s] : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {PDCA_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* 異物種別 */}
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="input-field text-xs"
              style={{ fontSize: '16px' }}
            >
              <option value="">{isEn ? 'All categories' : 'すべての異物種別'}</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* 期間 */}
          <div className="flex gap-2 items-center">
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="input-field text-xs flex-1" style={{ fontSize: '14px' }} />
            <span className="text-gray-400 text-xs">〜</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="input-field text-xs flex-1" style={{ fontSize: '14px' }} />
          </div>
        </div>

        {/* 一覧 */}
        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 text-sm">{isEn ? 'No records found' : '該当する記録がありません'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(inc => {
              const category = inc.estimations?.[0]?.category ?? ''
              const count = category ? (categoryCount.get(category) ?? 0) : 0
              const corrective = getBestCorrective(inc)
              const preventive = getBestPreventive(inc)
              const updatedBy = inc.actionsUpdatedBy ?? inc.causeVerifiedBy ?? ''
              const updatedAt = inc.actionsUpdatedAt ?? inc.causeVerifiedAt ?? ''

              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => router.push(`/record/${inc.id}`)}
                  className="w-full text-left card p-4 hover:shadow-md transition-all active:scale-[0.99]"
                >
                  {/* ヘッダー行 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm leading-snug">{inc.productName}</p>
                      <p className="text-[11px] text-gray-400">{inc.discoveryDate?.slice(0, 10)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {inc.pdcaStatus && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PDCA_STATUS_COLORS[inc.pdcaStatus]}`}>
                          {PDCA_STATUS_LABELS[inc.pdcaStatus]}
                        </span>
                      )}
                      {category && count > 1 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          ⚠️ 同種 {count}件
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 異物種別 */}
                  {category && (
                    <span className="inline-block text-[11px] bg-orange-50 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5 mb-2 font-semibold">
                      {category}
                    </span>
                  )}

                  {/* 是正・再発防止 */}
                  <div className="space-y-1">
                    {corrective ? (
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold text-gray-500">是正: </span>
                        {summarize(corrective)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">{isEn ? 'No corrective action' : '是正処置: 未入力'}</p>
                    )}
                    {preventive ? (
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold text-gray-500">再発防止: </span>
                        {summarize(preventive)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">{isEn ? 'No preventive measure' : '再発防止策: 未入力'}</p>
                    )}
                  </div>

                  {/* 最終更新者 */}
                  {(updatedBy || updatedAt) && (
                    <p className="text-[10px] text-gray-400 mt-2 text-right">
                      {updatedBy && `👤 ${updatedBy}`}
                      {updatedAt && ` ${new Date(updatedAt).toLocaleDateString('ja-JP')}`}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  )
}
