'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { listIncidents } from '@/lib/firestore'
import { DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS } from '@/lib/types'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import IncidentCard from '@/components/IncidentCard'
import type { Incident, DiscoveryProcess, IncidentStatus } from '@/lib/types'

export default function ListPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | ''>('')
  const [filterProcess, setFilterProcess] = useState<DiscoveryProcess | ''>('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    listIncidents(user.uid)
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [user])

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      const q = search.toLowerCase()
      if (
        q &&
        !inc.productName.toLowerCase().includes(q) &&
        !inc.lotNumber.toLowerCase().includes(q) &&
        !inc.factory.toLowerCase().includes(q) &&
        !inc.operator.toLowerCase().includes(q)
      ) return false
      if (filterStatus && inc.status !== filterStatus) return false
      if (filterProcess && inc.discoveryProcess !== filterProcess) return false
      return true
    })
  }, [incidents, search, filterStatus, filterProcess])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            {/* 大きな戻るボタン */}
            <button onClick={() => router.push('/')} className="back-btn shrink-0" aria-label="ホームに戻る">
              ←
            </button>
            <div className="flex-1">
              <h1 className="font-extrabold text-gray-800 text-lg leading-tight">事故一覧</h1>
              <p className="text-xs text-gray-500 font-medium">全 {incidents.length} 件</p>
            </div>
            <button
              onClick={() => router.push('/record')}
              className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl transition-all shadow-md shadow-orange-200"
            >
              ＋ 新規
            </button>
          </div>

          {/* 検索 */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field text-sm mb-2"
            placeholder="🔍 商品名・ロット・工場・担当者で検索"
          />

          {/* フィルター */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as IncidentStatus | '')}
              className="text-xs bg-white border border-orange-200 text-gray-600 rounded-xl px-3 py-2 shrink-0 focus:border-orange-400 focus:outline-none font-medium"
            >
              <option value="">すべての状態</option>
              {Object.entries(INCIDENT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={filterProcess}
              onChange={(e) => setFilterProcess(e.target.value as DiscoveryProcess | '')}
              className="text-xs bg-white border border-orange-200 text-gray-600 rounded-xl px-3 py-2 shrink-0 focus:border-orange-400 focus:outline-none font-medium"
            >
              <option value="">すべての工程</option>
              {Object.entries(DISCOVERY_PROCESS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {(search || filterStatus || filterProcess) && (
              <button
                onClick={() => { setSearch(''); setFilterStatus(''); setFilterProcess('') }}
                className="text-xs text-orange-500 hover:text-orange-600 font-bold px-2 py-2 shrink-0"
              >
                ✕ クリア
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-4 space-y-4">
        <UsageGuide
          title="📖 事故一覧・検索の使い方"
          color="orange"
          steps={[
            { icon: '🔍', title: 'キーワード検索', desc: '上の検索欄に製品名・ロット番号・担当者名などを入力すると、一致する記録だけが表示されます。' },
            { icon: '📌', title: 'フィルターで絞り込む', desc: '「未対応」「調査中」「完了」のステータスや、発見工程（受入・製造・出荷前など）で絞り込みができます。' },
            { icon: '📋', title: 'カードをタップして詳細を確認', desc: '各カードをタップすると詳細画面が開きます。ステータス変更・報告書生成・CSV出力ができます。' },
            { icon: '🔄', title: 'PDCA進捗を更新', desc: '詳細画面の「是正処置 PDCA」セクションで進捗（計画中→実施中→確認中→完了）を記録できます。' },
          ]}
          tips={[
            '同じロット番号の事故をまとめて確認したい場合は、ロット番号で検索してください',
            '「完了」になった事故も記録として残り、月次レポートに集計されます',
          ]}
        />
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500 font-medium text-base">
              {incidents.length === 0 ? '記録がありません' : '条件に一致する記録がありません'}
            </p>
            {incidents.length === 0 && (
              <button onClick={() => router.push('/record')} className="btn-primary mt-5 text-sm px-6">
                最初の異物を登録する
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
            <p className="text-xs text-gray-400 text-center pt-2 font-medium">
              {filtered.length} 件を表示
              {filtered.length !== incidents.length && `（全 ${incidents.length} 件）`}
            </p>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  )
}
