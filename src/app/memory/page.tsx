'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import Navigation from '@/components/Navigation'
import type { AiMemoryRecord } from '@/lib/ai-memory'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function MemoryPage() {
  const { user, loading } = useAuth()
  const { lang } = useLang()
  const isEn = lang === 'en'
  const router = useRouter()
  const [records, setRecords] = useState<AiMemoryRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [filter, setFilter] = useState<'all' | 'foreign_matter' | 'capa_draft'>('all')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const load = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch('/api/ai-memory')
      const data = await res.json()
      if (res.ok) setRecords(data.records ?? [])
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  async function handleToggle(id: string, current: boolean) {
    setToggling(id)
    try {
      await fetch('/api/ai-memory', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, active: !current }),
      })
      setRecords(prev => prev.map(r => r.id === id ? { ...r, active: !current } : r))
    } finally {
      setToggling(null)
    }
  }

  const filtered = records.filter(r => filter === 'all' || r.kind === filter)
  const activeCount = records.filter(r => r.active).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <div className="max-w-xl mx-auto px-4 pt-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-gray-800">
              {isEn ? '🧠 AI Memory' : '🧠 AI記憶'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEn
                ? `${activeCount} active cases used for AI suggestions`
                : `${activeCount}件の有効な事例がAI判定に活用されています`}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
          >
            {isEn ? '← Back' : '← 戻る'}
          </button>
        </div>

        {/* フィルター */}
        <div className="flex gap-2 mb-4">
          {(['all', 'foreign_matter', 'capa_draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                filter === f
                  ? 'bg-orange-400 border-orange-400 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? (isEn ? 'All' : 'すべて') :
               f === 'foreign_matter' ? (isEn ? 'Foreign Matter' : '異物判定') :
               (isEn ? 'CAPA' : 'CAPA下書き')}
              <span className="ml-1 text-[10px]">
                ({records.filter(r => f === 'all' || r.kind === f).length})
              </span>
            </button>
          ))}
        </div>

        {/* リスト */}
        {fetching ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm font-medium">
              {isEn ? 'No learned cases yet' : '学習済み事例はまだありません'}
            </p>
            <p className="text-xs mt-1">
              {isEn
                ? 'Cases are saved when you confirm foreign matter or save CAPA actions'
                : '異物の正解登録またはCAPAアクション保存時に自動で蓄積されます'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rec => (
              <div
                key={rec.id}
                className={`rounded-2xl border p-4 bg-white shadow-sm transition-opacity ${
                  rec.active ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* 種別バッジ */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        rec.kind === 'foreign_matter'
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-violet-50 border-violet-200 text-violet-700'
                      }`}>
                        {rec.kind === 'foreign_matter'
                          ? (isEn ? '🔍 Foreign Matter' : '🔍 異物判定')
                          : (isEn ? '📋 CAPA' : '📋 CAPA下書き')}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(rec.created_at)}</span>
                      {!rec.active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {isEn ? 'OFF' : '無効'}
                        </span>
                      )}
                    </div>
                    {/* カテゴリ */}
                    {rec.category && (
                      <p className="text-xs font-bold text-gray-700 truncate mb-0.5">
                        {rec.category}
                      </p>
                    )}
                    {/* 人が確定した内容 */}
                    <p className="text-xs text-gray-600 line-clamp-2">{rec.human_final}</p>
                    {/* 状況サマリ */}
                    {rec.input_summary && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">{rec.input_summary}</p>
                    )}
                  </div>
                  {/* 有効/無効トグル */}
                  <button
                    onClick={() => handleToggle(rec.id, rec.active)}
                    disabled={toggling === rec.id}
                    className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 disabled:opacity-50 ${
                      rec.active
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {toggling === rec.id
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      : rec.active ? (isEn ? '✓ Active' : '✓ 有効') : (isEn ? 'Disabled' : '無効')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
