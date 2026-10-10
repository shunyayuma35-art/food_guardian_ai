'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { getIncident, updateIncident, deleteIncident, createReport } from '@/lib/firestore'
import {
  DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS, CLAIM_ROUTE_LABELS, OCCURRENCE_TYPE_LABELS,
  PDCA_STATUS_LABELS, PDCA_STATUS_COLORS,
  type IncidentStatus, type PdcaStatus,
} from '@/lib/types'
import { generateIncidentCode, formatDate, formatDateTime } from '@/lib/utils'
import { generateIncidentReport, incidentToCSV } from '@/lib/report-generator'
import { generateIncidentDocx } from '@/lib/docx-generator'
import Navigation from '@/components/Navigation'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'
import toast from 'react-hot-toast'
import type { Incident } from '@/lib/types'

const URGENCY_CLASS = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }
const URGENCY_BAR = { high: 'bg-red-400', medium: 'bg-orange-400', low: 'bg-yellow-400' }

export default function IncidentDetailPage() {
  const { user, loading } = useAuth()
  const { t, lang } = useLang()
  const isEn = lang === 'en'
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [incident, setIncident] = useState<Incident | null>(null)
  const [fetching, setFetching] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [pdcaStatus, setPdcaStatus] = useState<PdcaStatus | undefined>(undefined)
  const [pdcaDeadline, setPdcaDeadline] = useState('')
  const [pdcaNotes, setPdcaNotes] = useState('')
  const [savingPdca, setSavingPdca] = useState(false)

  // AI根本原因分析
  const [showCausePanel, setShowCausePanel] = useState(false)
  const [causeLoading, setCauseLoading] = useState(false)
  const [causeText, setCauseText] = useState('')
  const [correctiveText, setCorrectiveText] = useState('')
  const [preventiveText, setPreventiveText] = useState('')
  const [verifyText, setVerifyText] = useState('')
  const [aiCauseRaw, setAiCauseRaw] = useState('')
  const [aiCorrectiveRaw, setAiCorrectiveRaw] = useState('')
  const [aiPreventiveRaw, setAiPreventiveRaw] = useState('')
  const [aiVerifyRaw, setAiVerifyRaw] = useState('')
  const [verifierName, setVerifierName] = useState('')
  const [savingCause, setSavingCause] = useState(false)
  const [causeVerifiedAt, setCauseVerifiedAt] = useState('')
  // 是正処置・再発防止 直接編集
  const [editCorrective, setEditCorrective] = useState('')
  const [editPreventive, setEditPreventive] = useState('')
  const [actionsEditor, setActionsEditor] = useState('')
  const [savingActions, setSavingActions] = useState(false)
  const [actionsUpdatedAt, setActionsUpdatedAt] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [regenEnLoading, setRegenEnLoading] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!id || !user) return
    getIncident(id)
      .then((data) => {
        if (data && data.createdBy !== user.uid) {
          router.replace('/list')
          return
        }
        setIncident(data)
        if (data) {
          setPdcaStatus(data.pdcaStatus)
          setPdcaDeadline(data.pdcaDeadline ?? '')
          setPdcaNotes(data.pdcaNotes ?? '')
          // AI分析保存済みデータを復元
          if (data.editedCause || data.aiCauseRaw) {
            setCauseText(data.editedCause ?? data.aiCauseRaw ?? '')
            setCorrectiveText(data.editedCorrective ?? data.aiCorrectiveRaw ?? '')
            setPreventiveText(data.editedPreventive ?? data.aiPreventiveRaw ?? '')
            setVerifyText(data.editedVerify ?? data.aiVerifyRaw ?? '')
            setAiCauseRaw(data.aiCauseRaw ?? '')
            setAiCorrectiveRaw(data.aiCorrectiveRaw ?? '')
            setAiPreventiveRaw(data.aiPreventiveRaw ?? '')
            setAiVerifyRaw(data.aiVerifyRaw ?? '')
            setVerifierName(data.causeVerifiedBy ?? '')
            setCauseVerifiedAt(data.causeVerifiedAt ?? '')
            if (data.aiCauseRaw) setShowCausePanel(true)
          }
          // 是正処置・再発防止の直接編集フィールドを初期化
          setEditCorrective(
            data.editedCorrective ?? data.aiCorrectiveRaw ?? data.correctiveAction ?? ''
          )
          setEditPreventive(
            data.editedPreventive ?? data.aiPreventiveRaw ?? data.preventiveMeasure ?? ''
          )
          setActionsUpdatedAt(data.actionsUpdatedAt ?? data.causeVerifiedAt ?? '')
        }
      })
      .catch(() => toast.error(t('toast.fetchFailed') || 'データの取得に失敗しました'))
      .finally(() => setFetching(false))
  }, [id, user, router])

  async function handleAiDraftDetail(mode: 'replace' | 'append') {
    if (!incident) return
    setDraftLoading(true)
    try {
      const lang = typeof window !== 'undefined' ? (localStorage.getItem('foodeye_lang') ?? 'ja') : 'ja'
      const topEst = incident.estimations?.[0] ?? null
      const res = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productName: incident.productName,
          comment: incident.comment,
          discoveryProcess: incident.discoveryProcess,
          aiResult: topEst ? {
            name: topEst.category,
            category: topEst.category,
            urgency: topEst.urgency,
          } : null,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      const corrDraft = Array.isArray(data.corrective) ? data.corrective.join('\n') : (data.corrective ?? '')
      const prevDraft = Array.isArray(data.preventive) ? data.preventive.join('\n') : (data.preventive ?? '')
      if (mode === 'replace') {
        setEditCorrective(corrDraft)
        setEditPreventive(prevDraft)
      } else {
        setEditCorrective(prev => prev ? `${prev}\n\n${corrDraft}` : corrDraft)
        setEditPreventive(prev => prev ? `${prev}\n\n${prevDraft}` : prevDraft)
      }
      toast.success(t('toast.aiDraftCreated') || (lang === 'en' ? 'AI draft created ✅' : 'AI下書きを作成しました ✅'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI draft failed'
      toast.error(msg)
    } finally {
      setDraftLoading(false)
    }
  }

  async function handleRegenEn() {
    if (!incident) return
    const photoUrl = incident.photos?.[0]
    if (!photoUrl) return
    setRegenEnLoading(true)
    try {
      const imgRes = await fetch(photoUrl)
      const blob = await imgRes.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const res = await fetch('/api/analyze-foreign-matter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: blob.type || 'image/jpeg', structured: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'regen failed')
      const qr = data.quickResult
      if (!qr) throw new Error('no result')
      const updatedEsts = [...(incident.estimations ?? [])]
      if (updatedEsts[0] && updatedEsts[0].source === 'ai_vision') {
        updatedEsts[0] = {
          ...updatedEsts[0],
          name: qr.name ?? updatedEsts[0].name,
          nameEn: qr.nameEn,
          route: qr.route ?? updatedEsts[0].route,
          routeEn: qr.routeEn,
          action: qr.action ?? updatedEsts[0].action,
          actionEn: qr.actionEn,
        }
      }
      await updateIncident(incident.id, { estimations: updatedEsts })
      setIncident(prev => prev ? { ...prev, estimations: updatedEsts } : prev)
      toast.success(t('toast.regenEnDone'))
    } catch {
      toast.error(t('toast.regenEnFailed'))
    } finally {
      setRegenEnLoading(false)
    }
  }

  async function handleSaveActions() {
    if (!incident) return
    if (!actionsEditor.trim()) {
      toast.error(t('toast.enterEditorName'))
      return
    }
    setSavingActions(true)
    try {
      const now = new Date().toISOString()
      await updateIncident(incident.id, {
        editedCorrective: editCorrective,
        editedPreventive: editPreventive,
        actionsUpdatedBy: actionsEditor,
        actionsUpdatedAt: now,
      })
      setActionsUpdatedAt(now)
      setIncident(prev => prev ? {
        ...prev,
        editedCorrective: editCorrective,
        editedPreventive: editPreventive,
        actionsUpdatedBy: actionsEditor,
        actionsUpdatedAt: now,
      } : prev)
      toast.success(t('toast.saveOk'))
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSavingActions(false)
    }
  }

  async function handleGenerateCause() {
    if (!incident) return
    setCauseLoading(true)
    try {
      const res = await fetch('/api/ai-cause', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ incident, lang: typeof window !== 'undefined' ? (localStorage.getItem('foodeye_lang') ?? 'ja') : 'ja' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      setAiCauseRaw(data.cause ?? '')
      setAiCorrectiveRaw(data.corrective ?? '')
      setAiPreventiveRaw(data.preventive ?? '')
      setAiVerifyRaw(data.verify ?? '')
      setCauseText(data.cause ?? '')
      setCorrectiveText(data.corrective ?? '')
      setPreventiveText(data.preventive ?? '')
      setVerifyText(data.verify ?? '')
      setShowCausePanel(true)
      toast.success(t('toast.aiCauseGenerated'))
    } catch (err) {
      toast.error(t('toast.aiCauseFailed'))
      console.error(err)
    } finally {
      setCauseLoading(false)
    }
  }

  async function handleSaveCause() {
    if (!incident || !verifierName.trim()) {
      toast.error(t('toast.enterVerifierName'))
      return
    }
    setSavingCause(true)
    try {
      const verifiedAt = new Date().toISOString()
      await updateIncident(incident.id, {
        aiCauseRaw,
        aiCorrectiveRaw,
        aiPreventiveRaw,
        aiVerifyRaw,
        editedCause: causeText,
        editedCorrective: correctiveText,
        editedPreventive: preventiveText,
        editedVerify: verifyText,
        causeVerifiedBy: verifierName,
        causeVerifiedAt: verifiedAt,
      })
      setCauseVerifiedAt(verifiedAt)
      setIncident(prev => prev ? {
        ...prev,
        aiCauseRaw, aiCorrectiveRaw, aiPreventiveRaw, aiVerifyRaw,
        editedCause: causeText, editedCorrective: correctiveText,
        editedPreventive: preventiveText, editedVerify: verifyText,
        causeVerifiedBy: verifierName, causeVerifiedAt: verifiedAt,
      } : prev)
      toast.success(t('toast.verifiedSaved'))
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSavingCause(false)
    }
  }

  async function handleStatusChange(status: IncidentStatus) {
    if (!incident) return
    try {
      await updateIncident(incident.id, { status })
      setIncident({ ...incident, status })
      toast.success(t('toast.statusUpdated'))
    } catch {
      toast.error(t('toast.statusFailed'))
    }
  }

  async function handleSavePdca() {
    if (!incident) return
    setSavingPdca(true)
    try {
      await updateIncident(incident.id, { pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined })
      setIncident({ ...incident, pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined })
      toast.success(t('toast.pdcaSaved'))
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSavingPdca(false)
    }
  }

  async function handleDelete() {
    if (!incident) return
    await deleteIncident(incident.id)
    toast.success(t('toast.deleted'))
    router.replace('/list')
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">😕</div>
        <p className="text-gray-500 font-medium">{t('common.notFound') || 'データが見つかりません'}</p>
        <button onClick={() => router.replace('/list')} className="btn-secondary text-sm">
          {t('common.backToList') || '一覧に戻る'}
        </button>
      </div>
    )
  }

  const topEst = incident.estimations?.[0]

  return (
    <div className="min-h-screen pb-28">
      {/* ライトボックス */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 no-print"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain rounded-2xl" />
          <button className="absolute top-5 right-5 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xl hover:bg-white/30">
            ✕
          </button>
        </div>
      )}

      {/* 削除確認 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-5 no-print">
          <div className="card p-6 w-full max-w-sm">
            <div className="text-4xl text-center mb-3">🗑️</div>
            <h3 className="font-extrabold text-gray-800 text-lg mb-2 text-center">{t('detail.deleteConfirmTitle')}</h3>
            <p className="text-gray-500 text-sm mb-5 text-center">
              {t('detail.deleteConfirmMsg')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 btn-secondary text-sm">
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-200">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* 大きな戻るボタン */}
          <button onClick={() => router.push('/list')} className="back-btn" aria-label="戻る">
            ←
          </button>

          <p className="font-mono text-sm font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
            {generateIncidentCode(incident.id)}
          </p>

          <button
            onClick={() => window.print()}
            className="text-xs text-gray-500 hover:text-orange-500 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-orange-300 bg-white transition-all"
          >
            🖨️ 印刷
          </button>
        </div>
      </header>

      {/* 印刷用ヘッダー */}
      <div className="hidden print:block p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-900">{t('detail.printTitle')}</h1>
        <p className="text-gray-600 text-sm">{t('detail.printMgmtNo')} {generateIncidentCode(incident.id)}</p>
        <p className="text-gray-600 text-sm">{t('detail.printIssued')} {new Date().toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">{t('detail.printDisclaimer')}</p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
        {/* ステータス */}
        <div className="card p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-medium">{t('detail.statusChange')}</span>
            <div className="flex gap-2">
              {(['open', 'investigating', 'closed'] as IncidentStatus[]).map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                    incident.status === s ? `badge-${s}` : 'text-gray-400 border-gray-200 bg-gray-50 hover:border-orange-300'
                  }`}
                >
                  {INCIDENT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          {topEst && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-bold badge-${topEst.urgency}`}>
              ⚡ {t(`urgency.${topEst.urgency}` as Parameters<typeof t>[0])}: {topEst.category}
            </div>
          )}
        </div>

        {/* AI推定結果 */}
        {incident.estimations && incident.estimations.length > 0 && (
          <div className="card p-4">
            <p className="section-title">{t('detail.aiEstTitle')}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
              <p className="text-yellow-700 text-xs font-medium">
                {t('detail.aiEstDisclaimer')}
              </p>
            </div>
            <div className="space-y-4">
              {incident.estimations.map((est, i) => {
                const displayName = isEn ? (est.nameEn ?? est.name ?? est.category) : (est.name ?? est.category)
                const displayRoutes = isEn ? (est.routeEn ?? est.route) : est.route
                const displayAction = isEn ? (est.actionEn ?? est.action) : est.action
                const needsEnRegen = isEn && est.source === 'ai_vision' && !est.nameEn && incident.photos?.length
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${URGENCY_CLASS[est.urgency]}`}>
                          {t(`urgency.${est.urgency}` as Parameters<typeof t>[0])}
                        </span>
                        <span className={`font-bold ${i === 0 ? 'text-gray-800 text-base' : 'text-gray-600 text-sm'}`}>
                          {displayName}
                        </span>
                      </div>
                      <span className={`font-extrabold text-lg ${i === 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {est.probability}%
                      </span>
                    </div>
                    <div className="bg-orange-50 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${URGENCY_BAR[est.urgency] ?? 'bg-orange-400'}`}
                        style={{ width: `${est.probability}%` }}
                      />
                    </div>
                    {est.basis.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {est.basis.map((b, j) => (
                          <span key={j}
                            className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 font-medium">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    {displayRoutes && displayRoutes.length > 0 && (
                      <div className="mt-1 mb-1">
                        <p className="text-[11px] text-gray-500 font-semibold mb-0.5">{t('detail.aiRouteLabel')}</p>
                        <div className="flex flex-wrap gap-1">
                          {displayRoutes.map((r, j) => (
                            <span key={j} className="text-[11px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-200">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {displayAction && (
                      <div className="mt-1">
                        <p className="text-[11px] text-gray-500 font-semibold mb-0.5">{t('detail.aiActionLabel')}</p>
                        <p className="text-xs text-gray-700">{displayAction}</p>
                      </div>
                    )}
                    {needsEnRegen && i === 0 && (
                      <button
                        type="button"
                        onClick={handleRegenEn}
                        disabled={regenEnLoading}
                        className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {regenEnLoading ? t('detail.regenEnLoading') : t('detail.regenEn')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 外部クレーム情報 */}
        {incident.occurrenceType === 'external' && (
          <div className="card p-4 border-l-4 border-purple-400">
            <p className="section-title">
              {t('detail.externalClaimInfo')}
              <span className="ml-2 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {OCCURRENCE_TYPE_LABELS['external']}
              </span>
            </p>
            <dl className="space-y-2.5">
              {incident.claimSource && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.claimSource')}</dt>
                  <dd className="text-sm text-gray-800 font-medium">{incident.claimSource}</dd>
                </div>
              )}
              {incident.claimDate && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.claimDate')}</dt>
                  <dd className="text-sm text-gray-800 font-medium">{incident.claimDate}</dd>
                </div>
              )}
              {incident.claimRoute && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.claimRoute')}</dt>
                  <dd className="text-sm text-gray-800 font-medium">{CLAIM_ROUTE_LABELS[incident.claimRoute]}</dd>
                </div>
              )}
              {incident.claimContent && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.claimContent')}</dt>
                  <dd className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{incident.claimContent}</dd>
                </div>
              )}
            </dl>
            {/* クレーム写真 */}
            {incident.claimPhotos && incident.claimPhotos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 font-semibold mb-2">{t('detail.claimPhotos')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {incident.claimPhotos.map((src, i) => (
                    <button key={i} type="button" onClick={() => setLightboxPhoto(src)}
                      className="aspect-square rounded-xl overflow-hidden bg-purple-50 hover:opacity-80 transition-opacity border border-purple-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 商品情報 */}
        <div className="card p-4">
          <p className="section-title">{t('detail.productInfo')}</p>
          <dl className="space-y-2.5">
            {[
              { label: t('detail.productName'), value: incident.productName },
              { label: t('detail.lotNumber'), value: incident.lotNumber },
              { label: t('detail.manufactureDate'), value: formatDate(incident.manufacturingDate) },
              { label: t('detail.expiryDate'), value: formatDate(incident.expiryDate) },
              { label: t('detail.lineNumber'), value: incident.lineNumber },
              { label: t('detail.factoryName'), value: incident.factory },
              { label: t('detail.operator'), value: incident.operator },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-sm text-gray-800 font-medium">{value}</dd>
                </div>
              ) : null
            )}
            <div className="flex items-start gap-3">
              <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.discoveryProcess')}</dt>
              <dd className="text-sm text-gray-800 font-medium">
                {DISCOVERY_PROCESS_LABELS[incident.discoveryProcess]}
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{t('detail.discoveryDatetime')}</dt>
              <dd className="text-sm text-gray-800 font-medium">{formatDateTime(incident.discoveryDate)}</dd>
            </div>
          </dl>
        </div>

        {/* 写真 */}
        {(incident.photos.length > 0 || incident.microscopePhotos.length > 0) && (
          <div className="card p-4">
            <p className="section-title">{t('detail.photoSection')}</p>
            {incident.photos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">{t('detail.normalPhotos')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {incident.photos.map((src, i) => (
                    <button key={i} type="button" onClick={() => setLightboxPhoto(src)}
                      className="aspect-square rounded-xl overflow-hidden bg-orange-50 hover:opacity-80 transition-opacity border border-orange-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {incident.microscopePhotos.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-2">{t('detail.microscopePhotos')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {incident.microscopePhotos.map((src, i) => (
                    <button key={i} type="button" onClick={() => setLightboxPhoto(src)}
                      className="aspect-square rounded-xl overflow-hidden bg-orange-50 hover:opacity-80 transition-opacity border border-orange-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 異物特徴 */}
        <div className="card p-4">
          <p className="section-title">{t('detail.featureCheck')}</p>
          <FeatureSummary features={incident.features} />
        </div>

        {/* 対応記録 */}
        {(incident.comment || incident.correctiveAction || incident.preventiveMeasure) && (
          <div className="card p-4">
            <p className="section-title">{t('detail.actionRecord')}</p>
            <div className="space-y-3">
              {incident.comment && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('detail.situationComment')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.comment}</p>
                </div>
              )}
              {incident.correctiveAction && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('detail.corrective')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.correctiveAction}</p>
                </div>
              )}
              {incident.preventiveMeasure && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('detail.preventive')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.preventiveMeasure}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 是正処置・再発防止 直接編集 */}
        <div className="card p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('detail.actionsCard')}</p>
            {actionsUpdatedAt && (
              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-semibold">
                ✅ {new Date(actionsUpdatedAt).toLocaleDateString('ja-JP')}
              </span>
            )}
          </div>

          {/* AI下書きボタン */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleAiDraftDetail('replace')}
              disabled={draftLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
            >
              {draftLoading
                ? <><span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />{t('detail.aiCreating')}</>
                : <>{t('detail.aiDraftReplace')}</>}
            </button>
            <button
              type="button"
              onClick={() => handleAiDraftDetail('append')}
              disabled={draftLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            >
              {draftLoading ? '...' : <>{t('detail.aiDraftAppend')}</>}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.correctiveLabel')}</label>
              <AutoResizeTextarea
                value={editCorrective}
                onChange={e => setEditCorrective(e.target.value)}
                className="input-field text-sm"
                placeholder="例: 当該ロットを隔離・出荷保留、現物を保管し品質管理部に報告..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.preventiveLabel')}</label>
              <AutoResizeTextarea
                value={editPreventive}
                onChange={e => setEditPreventive(e.target.value)}
                className="input-field text-sm"
                placeholder="例: 洗浄手順の見直し・教育実施・定期点検の強化..."
              />
            </div>
            <div>
              <label className="label">{t('detail.editorName')} <span className="text-red-400">*</span></label>
              <input
                value={actionsEditor}
                onChange={e => setActionsEditor(e.target.value)}
                className="input-field"
                placeholder="例: 品質管理部 鈴木"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {incident.actionsUpdatedBy && (
            <p className="text-[10px] text-gray-400 mt-2">
              {t('detail.lastUpdated')} {incident.actionsUpdatedBy}
              {incident.actionsUpdatedAt && ` （${new Date(incident.actionsUpdatedAt).toLocaleString()}）`}
            </p>
          )}

          <button
            onClick={handleSaveActions}
            disabled={savingActions || !actionsEditor.trim()}
            className="w-full mt-3 py-3 bg-orange-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-orange-200 disabled:opacity-50 hover:bg-orange-600 transition-all active:scale-[0.98]"
          >
            {savingActions ? t('common.saving') : t('detail.saveActions')}
          </button>
        </div>

        {/* 是正処置 PDCA */}
        <div className="card p-4 no-print">
          <p className="section-title">{t('detail.pdcaCard')}</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(['planned', 'doing', 'checking', 'done'] as PdcaStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setPdcaStatus(s)}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  pdcaStatus === s ? PDCA_STATUS_COLORS[s] : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                }`}>
                {t(`pdca.${s}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
          <div className="space-y-2 mb-3">
            <div>
              <label className="label">{t('detail.pdcaDeadline')}</label>
              <input type="date" value={pdcaDeadline} onChange={(e) => setPdcaDeadline(e.target.value)}
                className="input-field" />
            </div>
            <div>
              <label className="label">{t('detail.pdcaNotes')}</label>
              <AutoResizeTextarea value={pdcaNotes} onChange={(e) => setPdcaNotes(e.target.value)}
                className="input-field"
                placeholder="例: 2026-06-01 山田が原因調査実施。2026-06-10 全ライン点検予定。" />
            </div>
          </div>
          <button onClick={handleSavePdca} disabled={savingPdca}
            className="w-full py-3 bg-indigo-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-600 transition-all">
            {savingPdca ? t('common.saving') : t('detail.savePdca')}
          </button>
        </div>

        {/* AI 根本原因分析（4M） */}
        <div className="card p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('detail.causeCard')}</p>
            {causeVerifiedAt && (
              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-semibold">
                ✅ {new Date(causeVerifiedAt).toLocaleDateString()} {t('detail.verified')}
              </span>
            )}
          </div>

          {!showCausePanel ? (
            <button
              onClick={handleGenerateCause}
              disabled={causeLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {causeLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('detail.analyzing')}
                </>
              ) : (
                <>{t('detail.generateCause')}</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
                <p className="text-yellow-700 text-xs font-semibold">
                  {t('detail.causeDisclaimer')}
                </p>
              </div>

              {[
                { label: t('detail.causeLabel'), value: causeText, setter: setCauseText, raw: aiCauseRaw, rows: 6 },
                { label: t('detail.correctiveLabel2'), value: correctiveText, setter: setCorrectiveText, raw: aiCorrectiveRaw, rows: 4 },
                { label: t('detail.preventiveLabel2'), value: preventiveText, setter: setPreventiveText, raw: aiPreventiveRaw, rows: 4 },
                { label: t('detail.verifyLabel'), value: verifyText, setter: setVerifyText, raw: aiVerifyRaw, rows: 3 },
              ].map(({ label, value, setter, raw, rows }) => (
                <div key={label}>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">{label}</label>
                  <AutoResizeTextarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="input-field text-sm"
                  />
                  {raw && raw !== value && (
                    <button
                      type="button"
                      onClick={() => setter(raw)}
                      className="text-[10px] text-purple-500 hover:text-purple-700 mt-1"
                    >
                      {t('detail.aiRevert')}
                    </button>
                  )}
                </div>
              ))}

              <div>
                <label className="label">{t('detail.verifierName')} <span className="text-red-400">*</span></label>
                <input
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  className="input-field"
                  placeholder="例: 品質管理部 山田太郎"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCause}
                  disabled={causeLoading}
                  className="flex-1 py-2.5 bg-purple-100 text-purple-700 font-bold text-xs rounded-xl hover:bg-purple-200 disabled:opacity-50 transition-all"
                >
                  {causeLoading ? t('detail.analyzing') : t('detail.regenerate')}
                </button>
                <button
                  onClick={handleSaveCause}
                  disabled={savingCause || !verifierName.trim()}
                  className="flex-2 flex-1 py-2.5 bg-green-500 text-white font-bold text-sm rounded-xl shadow-md shadow-green-200 disabled:opacity-50 hover:bg-green-600 transition-all"
                >
                  {savingCause ? t('common.saving') : t('detail.saveVerified')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI 報告書・エクスポート */}
        <div className="card p-4 no-print">
          <p className="section-title">{t('detail.reportCard')}</p>
          <div className="space-y-2">
            <button
              onClick={async () => {
                if (!user) return
                setGeneratingReport(true)
                try {
                  const content = generateIncidentReport(incident)
                  const title = `クレーム報告書 - ${incident.productName}（${incident.lotNumber}）`
                  const reportId = await createReport({
                    type: 'incident', sourceId: incident.id, title, content,
                    productName: incident.productName, lotNumber: incident.lotNumber,
                    createdBy: user.uid,
                  })
                  toast.success(t('detail.reportSaved'))
                  router.push(`/report/${reportId}`)
                } catch { toast.error(t('detail.reportFailed')) }
                finally { setGeneratingReport(false) }
              }}
              disabled={generatingReport}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-sm shadow-md shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-xl">📝</span>
              {generatingReport ? t('detail.generatingReport') : t('detail.generateReport')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    const blob = await generateIncidentDocx(incident)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `クレーム報告書_${incident.productName}_${incident.lotNumber}.docx`; a.click()
                    URL.revokeObjectURL(url)
                    toast.success(t('detail.wordSaved'))
                  } catch {
                    toast.error(t('detail.wordFailed'))
                  }
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-100 text-blue-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-blue-200"
              >
                <span>📘</span> Word (.docx)
              </button>
              <button
                onClick={() => {
                  const csv = incidentToCSV(incident)
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `異物事故_${incident.productName}_${incident.lotNumber}.csv`; a.click()
                  URL.revokeObjectURL(url)
                  toast.success(t('detail.csvSaved'))
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-green-100 text-green-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-green-200"
              >
                <span>📗</span> Excel (.csv)
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {t('detail.createdAt')} {formatDateTime(incident.createdAt)} / {t('detail.updatedAt')} {formatDateTime(incident.updatedAt)}
        </p>

        <button onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3.5 text-red-500 hover:text-red-600 text-sm border border-red-200 hover:border-red-400 rounded-2xl transition-all bg-red-50/50 hover:bg-red-50 font-semibold no-print">
          {t('detail.deleteBtn')}
        </button>
      </div>

      <Navigation />
    </div>
  )
}

function FeatureSummary({ features }: { features: Incident['features'] }) {
  const { t } = useLang()
  const tags: string[] = []
  if (features.texture.hard) tags.push(t('feat.texture.hard'))
  if (features.texture.soft) tags.push(t('feat.texture.soft'))
  if (features.texture.elastic) tags.push(t('feat.texture.elastic'))
  if (features.texture.crumbly) tags.push(t('feat.texture.crumbly'))
  if (features.texture.sticky) tags.push(t('feat.texture.sticky'))
  if (features.appearance.glossy) tags.push(t('feat.surface.glossy'))
  if (features.appearance.translucent) tags.push(t('feat.surface.translucent'))
  if (features.appearance.burned) tags.push(t('feat.surface.burned'))
  if (features.appearance.fibrous) tags.push(t('feat.shape.fibrous'))
  if (features.appearance.granular) tags.push(t('feat.shape.granular'))
  if (features.appearance.layered) tags.push(t('feat.shape.layered'))
  if (features.appearance.bubbly) tags.push(t('feat.shape.bubbly'))
  if (features.appearance.metallic) tags.push(t('feat.surface.metallic'))
  if (features.color.black) tags.push(t('feat.color.black'))
  if (features.color.brown) tags.push(t('feat.color.brown'))
  if (features.color.white) tags.push(t('feat.color.white'))
  if (features.color.metalColor) tags.push(t('feat.color.metalColor'))
  if (features.color.transparent) tags.push(t('feat.color.transparent'))
  if (features.color.green) tags.push(t('feat.color.green'))
  if (features.smell.burnedSmell) tags.push(t('feat.smell.burnedSmell'))
  if (features.smell.oilSmell) tags.push(t('feat.smell.oilSmell'))
  if (features.smell.chemicalSmell) tags.push(t('feat.smell.chemicalSmell'))
  if (features.smell.noSmell) tags.push(t('feat.smell.noSmell'))
  if (features.waterTest.floats) tags.push(t('feat.water.floats'))
  if (features.waterTest.sinks) tags.push(t('feat.water.sinks'))
  if (features.waterTest.dissolves) tags.push(t('feat.water.dissolves'))
  if (features.waterTest.oilSurface) tags.push(t('feat.water.oilSurface'))

  if (tags.length === 0) return <p className="text-sm text-gray-400">{t('feat.noCheck')}</p>

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span key={i}
          className="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200 font-semibold">
          {tag}
        </span>
      ))}
    </div>
  )
}
