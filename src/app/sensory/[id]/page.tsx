'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import {
  getSensoryEvaluation, updateSensoryEvaluation, deleteSensoryEvaluation,
  findIncidentsByLot, createReport,
} from '@/lib/firestore'
import {
  SENSORY_JUDGEMENT_LABELS, APPEARANCE_EVAL_LABELS, SMELL_EVAL_LABELS,
  TASTE_EVAL_LABELS, TEXTURE_EVAL_LABELS, APPEARANCE_GRADE_LABELS,
} from '@/lib/types'
import { generateSensoryReport, sensoryToCSV, reportToWordHTML } from '@/lib/report-generator'
import Navigation from '@/components/Navigation'
import toast from 'react-hot-toast'
import type { SensoryEvaluation, Incident } from '@/lib/types'

const JUDGEMENT_COLOR = {
  pass:    { bg: 'from-green-400 to-emerald-400', badge: 'bg-green-100 text-green-700', icon: '✅' },
  warning: { bg: 'from-amber-400 to-orange-400',  badge: 'bg-amber-100 text-amber-700',  icon: '⚠️' },
  fail:    { bg: 'from-red-400 to-rose-400',      badge: 'bg-red-100 text-red-700',      icon: '❌' },
}

function RowItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 font-semibold w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium flex-1">{value}</span>
    </div>
  )
}

export default function SensoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const [ev, setEv] = useState<SensoryEvaluation | null>(null)
  const [linkedIncidents, setLinkedIncidents] = useState<Incident[]>([])
  const [fetching, setFetching] = useState(true)
  const [approving, setApproving] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const data = await getSensoryEvaluation(id)
    if (data && data.createdBy !== user.uid) {
      router.replace('/sensory')
      return
    }
    setEv(data)
    if (data?.lotNumber) {
      const incidents = await findIncidentsByLot(data.lotNumber, user.uid)
      setLinkedIncidents(incidents)
    }
    setFetching(false)
  }, [id, user, router])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  async function handleApprove() {
    if (!ev || !user) return
    setApproving(true)
    const approverName = ev.approverName || user.displayName || user.email || 'システム管理者'
    await updateSensoryEvaluation(id, {
      approvedAt: new Date().toISOString(),
      approvedBy: approverName,
    })
    toast.success('承認しました ✅')
    load()
    setApproving(false)
  }

  async function handleDelete() {
    await deleteSensoryEvaluation(id)
    toast.success(t('toast.deleted'))
    router.replace('/sensory')
  }

  async function handleGenerateReport() {
    if (!ev || !user) return
    setGeneratingReport(true)
    try {
      const content = generateSensoryReport(ev)
      const title = `官能検査報告書 - ${ev.productName}（${ev.lotNumber}）`
      const reportId = await createReport({
        type: 'sensory',
        sourceId: ev.id,
        title,
        content,
        productName: ev.productName,
        lotNumber: ev.lotNumber,
        createdBy: user.uid,
      })
      toast.success(t('toast.reportSaved'))
      router.push(`/report/${reportId}`)
    } catch {
      toast.error('報告書の生成に失敗しました')
    } finally {
      setGeneratingReport(false)
    }
  }

  function downloadCSV() {
    if (!ev) return
    const csv = sensoryToCSV(ev)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `官能検査_${ev.productName}_${ev.lotNumber}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('toast.excelDownloaded'))
  }

  function downloadWord() {
    if (!ev) return
    const content = generateSensoryReport(ev)
    const html = reportToWordHTML(`官能検査報告書 - ${ev.productName}`, content)
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `官能検査報告書_${ev.productName}_${ev.lotNumber}.doc`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('toast.wordDownloaded'))
  }

  async function copyToClipboard() {
    if (!ev) return
    const content = generateSensoryReport(ev)
    const title = `官能検査報告書 - ${ev.productName}（${ev.lotNumber}）`
    const text = `${title}\n${'─'.repeat(40)}\n${content}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('toast.copied'))
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast.success(t('toast.copied'))
    }
  }

  async function handleShare() {
    if (!ev) return
    const content = generateSensoryReport(ev)
    const title = `官能検査報告書 - ${ev.productName}（${ev.lotNumber}）`
    const text = `${title}\n${'─'.repeat(40)}\n${content}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text })
        toast.success(t('toast.shared'))
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          await copyToClipboard()
        }
      }
    } else {
      await copyToClipboard()
    }
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!ev) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{t('sensory.notFound')}</p>
        <button onClick={() => router.push('/sensory')} className="btn-primary">{t('sensory.backToList')}</button>
      </div>
    )
  }

  const jColor = JUDGEMENT_COLOR[ev.judgement]

  return (
    <div className="min-h-screen pb-24">
      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-lg font-extrabold text-gray-800 mb-2">{t('sensory.deleteConfirmTitle')}</p>
            <p className="text-sm text-gray-500 mb-6">{t('sensory.deleteConfirmMsg')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm shadow-md shadow-red-200">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-blue-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/sensory')} className="back-btn shrink-0">←</button>
          <div className="flex-1">
            <h1 className="font-extrabold text-gray-800 text-base leading-tight truncate">
              {ev.productName}
            </h1>
            <p className="text-xs text-gray-500">{t('sensory.detail.subtitle')}</p>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-500 font-bold px-2 py-1">{t('sensory.deleteBtn')}</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">
        {/* 判定バナー */}
        <div className={`bg-gradient-to-r ${jColor.bg} rounded-3xl p-5 text-center shadow-lg`}>
          <div className="text-5xl mb-2">{jColor.icon}</div>
          <p className="text-white text-2xl font-extrabold">{SENSORY_JUDGEMENT_LABELS[ev.judgement]}</p>
          <p className="text-white/80 text-sm mt-1">{ev.productName}</p>
          {ev.approvedAt ? (
            <div className="mt-3 bg-white/20 rounded-2xl px-4 py-2 inline-block">
              <p className="text-white text-xs font-bold">{t('sensory.approvedStatus')}（{ev.approvedBy}）</p>
            </div>
          ) : (
            <div className="mt-3 bg-white/20 rounded-2xl px-4 py-2 inline-block">
              <p className="text-white text-xs font-bold">{t('sensory.pendingStatus')}</p>
            </div>
          )}
        </div>

        {/* 基本情報 */}
        <div className="card p-5">
          <p className="section-title">{t('sensory.basicInfo')}</p>
          <RowItem label={t('sensory.productName')} value={ev.productName} />
          <RowItem label={t('sensory.lotNumber')} value={ev.lotNumber || '—'} />
          <RowItem label={t('sensory.datetime')} value={new Date(ev.date).toLocaleString()} />
          <RowItem label={t('sensory.inspectorName')} value={ev.inspectorName} />
          <RowItem label={t('sensory.approverName')} value={ev.approverName || '—'} />
        </div>

        {/* 官能評価 */}
        <div className="card p-5">
          <p className="section-title">{t('sensory.evaluations')}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('sensory.evalAppearance'), value: APPEARANCE_EVAL_LABELS[ev.appearance] },
              { label: t('sensory.evalSmell'), value: SMELL_EVAL_LABELS[ev.smell] },
              { label: t('sensory.evalTaste'), value: TASTE_EVAL_LABELS[ev.taste] },
              { label: t('sensory.evalTexture'), value: TEXTURE_EVAL_LABELS[ev.texture] },
            ].map(({ label, value }) => (
              <div key={label} className={`rounded-2xl p-3 ${value === '正常' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className="text-xs text-gray-500 font-semibold">{label}</p>
                <p className={`text-sm font-extrabold mt-0.5 ${value === '正常' ? 'text-green-700' : 'text-amber-700'}`}>{value}</p>
              </div>
            ))}
          </div>
          {ev.comment && (
            <div className="mt-4 bg-gray-50 rounded-2xl p-3">
              <p className="text-xs text-gray-500 font-semibold mb-1">{t('sensory.evalComment')}</p>
              <p className="text-sm text-gray-700 leading-relaxed">{ev.comment}</p>
            </div>
          )}
        </div>

        {/* 詳細スコア（新UI） */}
        {(ev.tasteScore || ev.scentEval || ev.appearanceGrade || ev.textureScore) && (
          <div className="card p-5">
            <p className="section-title">{t('sensory.detailScore')}</p>

            {/* 味覚 */}
            {ev.tasteScore && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">👅 味覚（5段階）</p>
                <div className="space-y-2">
                  {[
                    { label: '甘味', value: ev.tasteScore.sweet },
                    { label: '酸味', value: ev.tasteScore.sour },
                    { label: '塩味', value: ev.tasteScore.salty },
                    { label: '苦味', value: ev.tasteScore.bitter },
                    { label: 'うま味', value: ev.tasteScore.umami },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 shrink-0 font-semibold">{label}</span>
                      <div className="flex gap-1 flex-1">
                        {[1,2,3,4,5].map((n) => (
                          <div key={n} className={`flex-1 h-5 rounded-md ${
                            n <= value
                              ? label === '苦味' && value >= 4 ? 'bg-red-400'
                              : label === '苦味' ? 'bg-amber-400'
                              : 'bg-blue-400'
                              : 'bg-gray-100'
                          }`} />
                        ))}
                      </div>
                      <span className={`text-xs font-extrabold w-8 text-right ${
                        label === '苦味' && value >= 4 ? 'text-red-500' : 'text-gray-700'
                      }`}>{value}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 香り */}
            {ev.scentEval && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">👃 香り</p>
                <div className={`flex items-center gap-3 p-3 rounded-2xl ${
                  ev.scentEval.status === 'normal' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <span className="text-lg">{ev.scentEval.status === 'normal' ? '✅' : '⚠️'}</span>
                  <div>
                    <p className={`text-sm font-bold ${ev.scentEval.status === 'normal' ? 'text-green-700' : 'text-red-700'}`}>
                      {ev.scentEval.status === 'normal' ? '正常' : '異臭あり'}
                    </p>
                    {ev.scentEval.status === 'abnormal' && (
                      <p className="text-xs text-red-600">強度: {ev.scentEval.intensity}/5</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 外観グレード */}
            {ev.appearanceGrade && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">👁️ 外観グレード</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-sm ${
                  ev.appearanceGrade === 'good' ? 'bg-green-100 text-green-700' :
                  ev.appearanceGrade === 'limit' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {ev.appearanceGrade === 'good' ? '✅' : ev.appearanceGrade === 'limit' ? '⚠️' : '❌'}
                  {APPEARANCE_GRADE_LABELS[ev.appearanceGrade]}
                </div>
                {ev.limitSamplePhoto && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="text-xs font-bold text-amber-700 mb-2">📸 限度見本比較写真</p>
                    <div className="relative">
                      <img src={ev.limitSamplePhoto} alt="限度見本" className="w-full rounded-xl object-cover max-h-56 border border-amber-200" />
                      <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        限度見本
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2 text-center">入力時に添付された限度見本比較写真</p>
                  </div>
                )}
              </div>
            )}

            {/* 触感 */}
            {ev.textureScore && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 mb-2">✋ 触感・食感（5段階）</p>
                <div className="space-y-2">
                  {[
                    { label: '硬さ', value: ev.textureScore.hardness },
                    { label: '粘り', value: ev.textureScore.stickiness },
                    { label: '口どけ', value: ev.textureScore.mouthfeel },
                    { label: '歯ごたえ', value: ev.textureScore.chewiness },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 shrink-0 font-semibold">{label}</span>
                      <div className="flex gap-1 flex-1">
                        {[1,2,3,4,5].map((n) => (
                          <div key={n} className={`flex-1 h-5 rounded-md ${n <= value ? 'bg-indigo-400' : 'bg-gray-100'}`} />
                        ))}
                      </div>
                      <span className="text-xs font-extrabold text-gray-700 w-8 text-right">{value}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 音 */}
            {ev.soundEval && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">👂 音（聴覚）</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ev.soundEval.crunchy ? '🔊' : '🔇'}</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {ev.soundEval.crunchy ? 'パリッと音あり' : '音なし'}
                  </span>
                  {ev.soundEval.comment && (
                    <span className="text-xs text-gray-500">— {ev.soundEval.comment}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 判定方法 */}
        {ev.judgementMethod.length > 0 && (
          <div className="card p-5">
            <p className="section-title">{t('sensory.judgementMethod')}</p>
            <div className="flex flex-wrap gap-2">
              {ev.judgementMethod.map((m) => (
                <span key={m} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* 異物事故ひもづけ */}
        {linkedIncidents.length > 0 && (
          <div className="card p-5">
            <p className="section-title">{t('sensory.linkedIncidents')} ({linkedIncidents.length}{t('insp.unit')})</p>
            <div className="space-y-2">
              {linkedIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => router.push(`/record/${inc.id}`)}
                  className="w-full text-left p-3 rounded-2xl bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-all active:scale-[0.98]"
                >
                  <p className="text-sm font-bold text-orange-800">{inc.productName}</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    {inc.discoveryDate} ／ ロット：{inc.lotNumber}
                    {inc.estimations[0] && ` ／ 推定：${inc.estimations[0].category}`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 承認ボタン */}
        {!ev.approvedAt && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-1">{t('sensory.approvalNeeded')}</p>
            <p className="text-xs text-gray-600 mb-3">
              {t('sensory.approvalDesc')}
              {ev.approverName && ` ${t('sensory.approvedByLabel')}${ev.approverName}`}
            </p>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {approving ? t('sensory.approvingBtn') : t('sensory.approveBtn')}
            </button>
          </div>
        )}

        {/* 報告書・エクスポート */}
        <div className="card p-5">
          <p className="section-title">{t('sensory.reportSection')}</p>
          <div className="space-y-2">
            {/* AI報告書生成 */}
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-xl">📝</span>
              <span>{generatingReport ? t('sensory.generatingReport') : t('sensory.generateReport')}</span>
            </button>

            {/* 外部共有ボタン */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-extrabold text-sm shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <span className="text-xl">📤</span>
              <div className="text-left">
                <p className="text-sm font-extrabold">{t('sensory.shareBtn')}</p>
                <p className="text-xs text-white/70 font-normal">{t('sensory.shareDesc')}</p>
              </div>
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={copyToClipboard}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-purple-100 text-purple-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-purple-200"
              >
                <span className="text-lg">📋</span>{t('report.toolbar.copy').replace('📋 ', '')}
              </button>
              <button
                onClick={downloadWord}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-blue-100 text-blue-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-blue-200"
              >
                <span className="text-lg">📘</span>Word
              </button>
              <button
                onClick={downloadCSV}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-green-100 text-green-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-green-200"
              >
                <span className="text-lg">📗</span>Excel
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              {t('sensory.exportFooter')}
            </p>
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
