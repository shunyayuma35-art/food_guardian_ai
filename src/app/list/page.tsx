'use client'

import { parseAiTitle, parseAiLocation } from '@/lib/ai-label'
import { formatLocalDate } from '@/lib/utils'

const AI_CHAT_LOC_RE = /Recorded from AI chat|AI対話から記録|AIチャット|AI chat|\[AI_CHAT\]/i

function fixLegacyText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/Claude検索結果/g, 'AI検索結果')
    .replace(/Claude検索/g, 'AI検索')
    .replace(/Claude Search Result/gi, 'AI Search Result')
    .replace(/Claude Search/gi, 'AI Search')
}

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import toast from 'react-hot-toast'
import type { IncidentStatus } from '@/lib/types'

type AiIncident = {
  id: number
  created_at: string
  title: string
  location: string
  description: string
  status: string
  image_url: string | null
  archived_at:    string | null
  archived_by:    string | null
  archive_reason: string | null
  lang:           string | null
}

export default function ListPage() {
  const { user, loading } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | ''>('')
  const [aiIncidents, setAiIncidents] = useState<AiIncident[]>([])
  const [aiFetching, setAiFetching] = useState(true)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<number | null>(null)
  // アーカイブ・削除・状態変更
  const [showArchived, setShowArchived] = useState(false)
  const [archiveModal, setArchiveModal] = useState<{ id: number; title: string } | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiverName, setArchiverName] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ id: number; title: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const AI_STATUS_LABELS: Record<string, string> = {
    investigating: t('list.status.investigating'),
    resolved: t('list.status.resolved'),
    pending: t('list.status.open'),
    open: t('list.status.open'),
  }

  const AI_STATUS_COLORS: Record<string, string> = {
    investigating: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    pending: 'bg-red-100 text-red-700',
    open: 'bg-red-100 text-red-700',
  }

  const isEn = lang === 'en'

  // AI記録の状態サイクル
  function nextAiStatus(current: string): string {
    const cycle = ['open', 'investigating', 'resolved']
    const normalized = current === 'pending' ? 'open' : current
    const idx = cycle.indexOf(normalized)
    return cycle[(idx + 1) % cycle.length]
  }

  async function handleStatusChangeAi(id: number, current: string) {
    const next = nextAiStatus(current)
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('status update failed')
      setAiIncidents(prev => prev.map(i => i.id === id ? { ...i, status: next } : i))
    } catch {
      toast.error(isEn ? 'Failed to update status' : '状態の更新に失敗しました')
    }
  }

  async function handleArchiveAi(id: number, reason: string, by: string) {
    setArchiving(true)
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          archived_at: new Date().toISOString(),
          archived_by: by,
          archive_reason: reason,
        }),
      })
      if (!res.ok) throw new Error('archive failed')
      setAiIncidents(prev => prev.map(i =>
        i.id === id ? { ...i, archived_at: new Date().toISOString(), archived_by: by, archive_reason: reason } : i
      ))
      setArchiveModal(null)
      setArchiveReason('')
      setArchiverName('')
      toast.success(isEn ? 'Archived successfully' : 'アーカイブしました')
    } catch {
      toast.error(isEn ? 'Archive failed. SQL may not have been run yet.' : 'アーカイブ失敗。SQLが未実行の可能性があります')
    } finally {
      setArchiving(false)
    }
  }

  async function handleUnarchiveAi(id: number) {
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived_at: null, archived_by: null, archive_reason: null }),
      })
      if (!res.ok) throw new Error('unarchive failed')
      setAiIncidents(prev => prev.map(i =>
        i.id === id ? { ...i, archived_at: null, archived_by: null, archive_reason: null } : i
      ))
      toast.success(isEn ? 'Restored from archive' : 'アーカイブを解除しました')
    } catch {
      toast.error(isEn ? 'Restore failed' : '復元に失敗しました')
    }
  }

  async function handleDeleteAi(id: number) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setAiIncidents(prev => prev.filter(i => i.id !== id))
      setDeleteModal(null)
      setDeleteConfirm('')
      toast.success(isEn ? 'Deleted permanently' : '完全に削除しました')
    } catch {
      toast.error(isEn ? 'Delete failed' : '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    fetch('/api/incidents')
      .then((r) => r.json())
      .then((data) => setAiIncidents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setAiFetching(false))
  }, [])

  // ホーム画面のカードタップで渡された初期フィルタを適用
  useEffect(() => {
    if (typeof window === 'undefined') return
    const f = sessionStorage.getItem('listFilter')
    if (!f) return
    sessionStorage.removeItem('listFilter')
    if (f === 'today') {
      setSearch(formatLocalDate())
    } else if (f === 'active') {
      setFilterStatus('open')
    }
    // 'all' はフィルタなし
  }, [])

  async function handlePhotoUpload(file: File, incidentId: number) {
    setUploadingId(incidentId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      const { url, error: uploadErr } = await uploadRes.json()
      if (uploadErr) throw new Error(uploadErr)

      const patchRes = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url }),
      })
      if (!patchRes.ok) throw new Error('更新失敗')

      setAiIncidents((prev) =>
        prev.map((inc) => inc.id === incidentId ? { ...inc, image_url: url } : inc)
      )
      toast.success(t('toast.photoSaved'))
    } catch (err) {
      console.error(err)
      toast.error(t('toast.photoFailed'))
    } finally {
      setUploadingId(null)
    }
  }

  const filteredAi = useMemo(() => {
    const q = search.toLowerCase()
    return aiIncidents.filter((inc) => {
      // アーカイブ表示切り替え
      if (showArchived ? !inc.archived_at : inc.archived_at) return false
      // 状態フィルタ（Firestore の closed = Supabase の resolved）
      if (filterStatus) {
        const matchStatus = filterStatus === 'closed' ? 'resolved' : filterStatus
        const normalized = inc.status === 'pending' ? 'open' : inc.status
        if (normalized !== matchStatus) return false
      }
      if (q) {
        const displayTitle = parseAiTitle(inc.title, lang).toLowerCase()
        const displayLoc = parseAiLocation(inc.location, lang).toLowerCase()
        if (!displayTitle.includes(q) && !displayLoc.includes(q) && !inc.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [aiIncidents, search, showArchived, filterStatus])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalCount = aiIncidents.filter(i => !i.archived_at).length

  // ── 傾向分析データ（アーカイブ除外） ──────────────────────────────
  const activeAi = useMemo(() => aiIncidents.filter(i => !i.archived_at), [aiIncidents])

  const trendByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    activeAi.forEach(inc => {
      const ym = inc.created_at.slice(0, 7) // "YYYY-MM"
      map[ym] = (map[ym] ?? 0) + 1
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  }, [activeAi])

  const trendByLocation = useMemo(() => {
    const map: Record<string, number> = {}
    activeAi.forEach(inc => {
      const loc = inc.location?.trim()
      if (!loc || AI_CHAT_LOC_RE.test(loc)) return
      map[loc] = (map[loc] ?? 0) + 1
    })
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5)
  }, [activeAi])

  const trendByStatus = useMemo(() => {
    const map: Record<string, number> = { open: 0, investigating: 0, resolved: 0 }
    activeAi.forEach(inc => {
      const s = inc.status === 'pending' ? 'open' : inc.status
      if (s in map) map[s]++
    })
    return map
  }, [activeAi])

  return (
    <div className="min-h-screen pb-24">
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain rounded-2xl" />
          <button className="absolute top-5 right-5 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xl hover:bg-white/30">✕</button>
        </div>
      )}

      {/* ── アーカイブモーダル ── */}
      {archiveModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-800">
              📦 {isEn ? 'Archive this record?' : 'アーカイブしますか？'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {isEn
                ? 'Records are kept for HACCP compliance. They will not be deleted.'
                : 'HACCPの記録保持のため、データは削除されません。一覧から非表示になります。'}
            </p>
            <p className="text-xs font-semibold text-gray-700 line-clamp-2">「{archiveModal.title}」</p>
            <div className="space-y-2">
              <input
                type="text"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder={isEn ? 'Reason (required)' : 'アーカイブ理由（必須）'}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400/50"
              />
              <input
                type="text"
                value={archiverName}
                onChange={e => setArchiverName(e.target.value)}
                placeholder={isEn ? 'Your name (required)' : '実施者名（必須）'}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleArchiveAi(archiveModal.id, archiveReason.trim(), archiverName.trim())}
                disabled={archiving || !archiveReason.trim() || !archiverName.trim()}
                className="flex-1 py-2.5 bg-orange-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
              >
                {archiving ? '…' : (isEn ? '📦 Archive' : '📦 アーカイブ')}
              </button>
              <button
                onClick={() => { setArchiveModal(null); setArchiveReason(''); setArchiverName('') }}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl active:scale-95"
              >
                {isEn ? 'Cancel' : 'キャンセル'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 完全削除モーダル ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-sm font-bold text-red-700">
                {isEn ? 'Permanent Delete' : '完全削除'}
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {isEn
                ? 'This action cannot be undone. The record will be permanently deleted.'
                : 'この操作は元に戻せません。記録が完全に削除されます。'}
            </p>
            <p className="text-xs font-semibold text-gray-700 line-clamp-2">「{deleteModal.title}」</p>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                {isEn ? 'Type DELETE to confirm:' : '確認のため「削除」と入力:'}
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={isEn ? 'DELETE' : '削除'}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteAi(deleteModal.id)}
                disabled={deleting || deleteConfirm !== (isEn ? 'DELETE' : '削除')}
                className="flex-1 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
              >
                {deleting ? '…' : (isEn ? '🗑️ Delete' : '🗑️ 完全削除')}
              </button>
              <button
                onClick={() => { setDeleteModal(null); setDeleteConfirm('') }}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl active:scale-95"
              >
                {isEn ? 'Cancel' : 'キャンセル'}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && uploadTargetId.current !== null) {
            handlePhotoUpload(file, uploadTargetId.current)
          }
          e.target.value = ''
        }}
      />

      <header className="bg-white border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/')} className="back-btn shrink-0" aria-label={t('common.back')}>
              ←
            </button>
            <div className="flex-1">
              <h1 className="font-extrabold text-gray-800 text-lg leading-tight">{t('list.pageTitle')}</h1>
              <p className="text-xs text-gray-500 font-medium">{t('list.totalCount').replace('{n}', String(totalCount))}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/actions')}
                className="text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl transition-all border border-violet-200"
              >
                🔄 {isEn ? 'Actions' : '是正'}
              </button>
              <button
                onClick={() => router.push('/record')}
                className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl transition-all shadow-md shadow-orange-200"
              >
                ＋ {t('common.new')}
              </button>
            </div>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field text-sm mb-2"
            placeholder={`🔍 ${t('record.productName')}・${t('record.lotNo')}・${t('record.factory')}・${t('record.operator')}`}
          />

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as IncidentStatus | '')}
              className="text-xs bg-white border border-orange-200 text-gray-600 rounded-xl px-3 py-2 shrink-0 focus:border-orange-400 focus:outline-none font-medium"
            >
              <option value="">{t('list.allStatus')}</option>
              <option value="open">{t('list.status.open')}</option>
              <option value="investigating">{t('list.status.investigating')}</option>
              <option value="closed">{t('list.status.resolved')}</option>
            </select>

            {(search || filterStatus) && (
              <button
                onClick={() => { setSearch(''); setFilterStatus('') }}
                className="text-xs text-orange-500 hover:text-orange-600 font-bold px-2 py-2 shrink-0"
              >
                ✕ {t('common.clear')}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-4 space-y-4">
        <UsageGuide
          title={t('guide.list')}
          color="orange"
          steps={[
            { icon: '🔍', title: t('list.guide.step1.title'), desc: t('list.guide.step1.desc') },
            { icon: '📌', title: t('list.guide.step2.title'), desc: t('list.guide.step2.desc') },
            { icon: '📋', title: t('list.guide.step3.title'), desc: t('list.guide.step3.desc') },
          ]}
          tips={[
            t('list.guide.tip1'),
          ]}
        />

        {/* 傾向分析 */}
        {activeAi.length > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <span>📊</span>
              {isEn ? 'Trend Analysis' : '傾向分析'}
              <span className="text-xs font-normal text-gray-400">
                ({isEn ? 'excl. archived' : 'アーカイブ除く'})
              </span>
            </h2>

            {/* 月別件数 */}
            {trendByMonth.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {isEn ? 'Monthly Incidents' : '月別件数'}
                </p>
                <div className="space-y-1.5">
                  {trendByMonth.map(([ym, cnt]) => {
                    const maxCnt = Math.max(...trendByMonth.map(([, c]) => c), 1)
                    const pct = Math.round((cnt / maxCnt) * 100)
                    const label = isEn
                      ? new Date(ym + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
                      : new Date(ym + '-01').toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
                    return (
                      <div key={ym} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-14 shrink-0">{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-2.5 rounded-full bg-orange-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 w-5 text-right">{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 状態内訳 */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {isEn ? 'Status Breakdown' : '状態内訳'}
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'open', label: t('list.status.open'), color: 'bg-red-100 text-red-700 border-red-200' },
                  { key: 'investigating', label: t('list.status.investigating'), color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                  { key: 'resolved', label: t('list.status.resolved'), color: 'bg-green-100 text-green-700 border-green-200' },
                ].map(({ key, label, color }) => (
                  <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${color}`}>
                    <span className="font-extrabold text-sm">{trendByStatus[key] ?? 0}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 場所別 */}
            {trendByLocation.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {isEn ? 'Top Locations' : '場所別 Top 5'}
                </p>
                <div className="space-y-1.5">
                  {trendByLocation.map(([loc, cnt]) => {
                    const maxCnt = Math.max(...trendByLocation.map(([, c]) => c), 1)
                    const pct = Math.round((cnt / maxCnt) * 100)
                    return (
                      <div key={loc} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 truncate flex-1 max-w-[120px]">📍 {loc}</span>
                        <div className="w-24 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-2.5 rounded-full bg-blue-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 w-5 text-right">{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI解析セクション */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-600 flex items-center gap-2">
              <span className="text-base">🤖</span> {t('list.aiSection')}
              <span className="text-xs font-normal text-gray-400">{t('list.supabaseSaved')}</span>
            </h2>
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                showArchived
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {showArchived
                ? (isEn ? '← Active' : '← 通常表示')
                : (isEn ? '📦 Archived' : '📦 アーカイブ')}
            </button>
          </div>
          {aiFetching ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAi.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {showArchived
                ? (isEn ? 'No archived records' : 'アーカイブされた記録はありません')
                : t('list.noAi')}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAi.map((inc) => (
                <div
                  key={inc.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm ${inc.archived_at ? 'border-amber-200 bg-amber-50/30 opacity-80' : 'border-blue-100'}`}
                >
                  {/* ── タイトル行：ステータス（タップで変更）・言語バッジ ── */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className={`font-bold text-gray-800 text-sm leading-snug flex-1 ${inc.archived_at ? 'text-gray-500' : ''}`}>
                      {parseAiTitle(fixLegacyText(inc.title), lang)}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 言語バッジ */}
                      {inc.lang && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase">
                          {inc.lang}
                        </span>
                      )}
                      {/* 状態バッジ（アーカイブ済み以外はタップで変更可） */}
                      {inc.archived_at ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          📦 {isEn ? 'Archived' : 'アーカイブ済'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleStatusChangeAi(inc.id, inc.status)}
                          title={isEn ? 'Tap to change status' : 'タップで状態変更'}
                          className={`text-xs font-bold px-2 py-1 rounded-full active:scale-95 transition-all cursor-pointer ${AI_STATUS_COLORS[inc.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {AI_STATUS_LABELS[inc.status] ?? inc.status}
                        </button>
                      )}
                    </div>
                  </div>

                  {inc.location && (
                    <p className="text-xs text-gray-500 mb-1">📍 {parseAiLocation(inc.location, lang)}</p>
                  )}
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{fixLegacyText(inc.description)?.replace(/\*\*/g, '')}</p>

                  {/* アーカイブ情報 */}
                  {inc.archived_at && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[10px] text-amber-700 space-y-0.5">
                      <p>📦 {isEn ? 'Archived' : 'アーカイブ日'}: {new Date(inc.archived_at).toLocaleDateString(isEn ? 'en-US' : 'ja-JP')}</p>
                      {inc.archive_reason && <p>📝 {isEn ? 'Reason' : '理由'}: {inc.archive_reason}</p>}
                      {inc.archived_by && <p>👤 {isEn ? 'By' : '実施者'}: {inc.archived_by}</p>}
                    </div>
                  )}

                  {/* 写真 */}
                  {!inc.archived_at && (inc.image_url ? (
                    <button
                      type="button"
                      className="mt-3 w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxPhoto(inc.image_url!)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={inc.image_url} alt={t('list.photoAlt')} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingId === inc.id}
                      onClick={() => {
                        uploadTargetId.current = inc.id
                        fileInputRef.current?.click()
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-400 text-xs font-semibold hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50"
                    >
                      {uploadingId === inc.id ? (
                        <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> {t('list.uploading')}</>
                      ) : (
                        <><span>📷</span> {t('list.addPhoto').replace('📷 ', '')}</>
                      )}
                    </button>
                  ))}

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {new Date(inc.created_at).toLocaleDateString(isEn ? 'en-US' : 'ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    {/* アクションボタン */}
                    <div className="flex gap-1.5">
                      {inc.archived_at ? (
                        <button
                          onClick={() => handleUnarchiveAi(inc.id)}
                          className="text-[10px] px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg font-medium active:scale-95 transition-all"
                        >
                          {isEn ? '↩ Restore' : '↩ 元に戻す'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setArchiveModal({ id: inc.id, title: inc.title })}
                          className="text-[10px] px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg font-medium active:scale-95 transition-all hover:bg-gray-200"
                        >
                          {isEn ? '📦 Archive' : '📦 アーカイブ'}
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteModal({ id: inc.id, title: inc.title }); setDeleteConfirm('') }}
                        className="text-[10px] px-2.5 py-1 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium active:scale-95 transition-all hover:bg-red-100"
                      >
                        {isEn ? '🗑️ Delete' : '🗑️ 削除'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <Navigation />
    </div>
  )
}
