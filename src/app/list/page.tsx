'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { listIncidents } from '@/lib/firestore'
import { DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS } from '@/lib/types'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import IncidentCard from '@/components/IncidentCard'
import toast from 'react-hot-toast'
import type { Incident, DiscoveryProcess, IncidentStatus } from '@/lib/types'

type AiIncident = {
  id: number
  created_at: string
  title: string
  location: string
  description: string
  status: string
  image_url: string | null
}

export default function ListPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | ''>('')
  const [filterProcess, setFilterProcess] = useState<DiscoveryProcess | ''>('')
  const [aiIncidents, setAiIncidents] = useState<AiIncident[]>([])
  const [aiFetching, setAiFetching] = useState(true)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<number | null>(null)

  const AI_STATUS_LABELS: Record<string, string> = {
    investigating: t('list.status.investigating'),
    resolved: t('list.status.resolved'),
    pending: t('list.status.open'),
  }

  const AI_STATUS_COLORS: Record<string, string> = {
    investigating: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    pending: 'bg-red-100 text-red-700',
  }

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

  useEffect(() => {
    fetch('/api/incidents')
      .then((r) => r.json())
      .then((data) => setAiIncidents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setAiFetching(false))
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

  const filteredAi = useMemo(() => {
    const q = search.toLowerCase()
    return aiIncidents.filter((inc) => {
      if (q && !inc.title.toLowerCase().includes(q) && !inc.location.toLowerCase().includes(q) && !inc.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [aiIncidents, search])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalCount = incidents.length + aiIncidents.length

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

      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/')} className="back-btn shrink-0" aria-label={t('common.back')}>
              ←
            </button>
            <div className="flex-1">
              <h1 className="font-extrabold text-gray-800 text-lg leading-tight">{t('list.pageTitle')}</h1>
              <p className="text-xs text-gray-500 font-medium">{t('list.totalCount').replace('{n}', String(totalCount))}</p>
            </div>
            <button
              onClick={() => router.push('/record')}
              className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl transition-all shadow-md shadow-orange-200"
            >
              ＋ {t('common.new')}
            </button>
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
              {Object.entries(INCIDENT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={filterProcess}
              onChange={(e) => setFilterProcess(e.target.value as DiscoveryProcess | '')}
              className="text-xs bg-white border border-orange-200 text-gray-600 rounded-xl px-3 py-2 shrink-0 focus:border-orange-400 focus:outline-none font-medium"
            >
              <option value="">{t('list.allProcess')}</option>
              {Object.entries(DISCOVERY_PROCESS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {(search || filterStatus || filterProcess) && (
              <button
                onClick={() => { setSearch(''); setFilterStatus(''); setFilterProcess('') }}
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
            { icon: '🔍', title: 'キーワード検索', desc: '上の検索欄に製品名・ロット番号・担当者名などを入力すると、一致する記録だけが表示されます。' },
            { icon: '📌', title: 'フィルターで絞り込む', desc: 'ステータスや発見工程で絞り込みができます。' },
            { icon: '📋', title: 'カードをタップして詳細を確認', desc: '各カードをタップすると詳細画面が開きます。' },
          ]}
          tips={[
            '同じロット番号の事故をまとめて確認したい場合は、ロット番号で検索してください',
          ]}
        />

        {/* AI解析セクション */}
        <div>
          <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-base">🤖</span> {t('list.aiSection')}
            <span className="text-xs font-normal text-gray-400">（Supabase保存）</span>
          </h2>
          {aiFetching ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAi.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t('list.noAi')}</div>
          ) : (
            <div className="space-y-3">
              {filteredAi.map((inc) => (
                <div key={inc.id} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-gray-800 text-sm leading-snug">{inc.title}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${AI_STATUS_COLORS[inc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {AI_STATUS_LABELS[inc.status] ?? inc.status}
                    </span>
                  </div>
                  {inc.location && (
                    <p className="text-xs text-gray-500 mb-1">📍 {inc.location}</p>
                  )}
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{inc.description}</p>

                  {inc.image_url ? (
                    <button
                      type="button"
                      className="mt-3 w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxPhoto(inc.image_url!)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={inc.image_url} alt="調査写真" className="w-full h-full object-cover" />
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
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(inc.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 異物事故記録セクション */}
        <div>
          <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-base">📋</span> {t('list.incidentSection')}
          </h2>
          {fetching ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-500 font-medium text-base">
                {incidents.length === 0 ? t('list.noRecords') : t('list.noFiltered')}
              </p>
              {incidents.length === 0 && (
                <button onClick={() => router.push('/record')} className="btn-primary mt-5 text-sm px-6">
                  {t('home.firstRecord')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
              <p className="text-xs text-gray-400 text-center pt-2 font-medium">
                {t('list.showing').replace('{n}', String(filtered.length))}
                {filtered.length !== incidents.length && `（全 ${incidents.length} 件）`}
              </p>
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  )
}
