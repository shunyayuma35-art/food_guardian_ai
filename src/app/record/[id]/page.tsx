'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getIncident, updateIncident, deleteIncident, createReport } from '@/lib/firestore'
import {
  DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS, CLAIM_ROUTE_LABELS, OCCURRENCE_TYPE_LABELS,
  PDCA_STATUS_LABELS, PDCA_STATUS_COLORS,
  type IncidentStatus, type PdcaStatus,
} from '@/lib/types'
import { generateIncidentCode, formatDate, formatDateTime } from '@/lib/utils'
import { generateIncidentReport, incidentToCSV, reportToWordHTML } from '@/lib/report-generator'
import Navigation from '@/components/Navigation'
import toast from 'react-hot-toast'
import type { Incident } from '@/lib/types'

const URGENCY_LABEL = { high: '緊急', medium: '注意', low: '軽微' }
const URGENCY_CLASS = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }
const URGENCY_BAR = { high: 'bg-red-400', medium: 'bg-orange-400', low: 'bg-yellow-400' }

export default function IncidentDetailPage() {
  const { user, loading } = useAuth()
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
        }
      })
      .catch(() => toast.error('データの取得に失敗しました'))
      .finally(() => setFetching(false))
  }, [id, user, router])

  async function handleStatusChange(status: IncidentStatus) {
    if (!incident) return
    try {
      await updateIncident(incident.id, { status })
      setIncident({ ...incident, status })
      toast.success('ステータスを更新しました')
    } catch {
      toast.error('ステータスの更新に失敗しました')
    }
  }

  async function handleSavePdca() {
    if (!incident) return
    setSavingPdca(true)
    try {
      await updateIncident(incident.id, { pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined })
      setIncident({ ...incident, pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined })
      toast.success('PDCA状況を保存しました ✅')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingPdca(false)
    }
  }

  async function handleDelete() {
    if (!incident) return
    await deleteIncident(incident.id)
    toast.success('削除しました')
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
        <p className="text-gray-500 font-medium">データが見つかりません</p>
        <button onClick={() => router.replace('/list')} className="btn-secondary text-sm">
          一覧に戻る
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
            <h3 className="font-extrabold text-gray-800 text-lg mb-2 text-center">削除の確認</h3>
            <p className="text-gray-500 text-sm mb-5 text-center">
              この記録を完全に削除します。<br />この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 btn-secondary text-sm">
                キャンセル
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-200">
                削除する
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
        <h1 className="text-2xl font-bold text-gray-900">食品異物事故報告書</h1>
        <p className="text-gray-600 text-sm">管理番号: {generateIncidentCode(incident.id)}</p>
        <p className="text-gray-600 text-sm">発行: {new Date().toLocaleString('ja-JP')}</p>
        <p className="text-xs text-gray-400 mt-1">
          ※ 本報告書はAI一次判定に基づく推定支援システムの出力です。確定分析には外部専門機関による鑑定が必要です。
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
        {/* ステータス */}
        <div className="card p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 font-medium">ステータス変更</span>
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
              ⚡ {URGENCY_LABEL[topEst.urgency]}度: {topEst.category}
            </div>
          )}
        </div>

        {/* AI推定結果 */}
        {incident.estimations && incident.estimations.length > 0 && (
          <div className="card p-4">
            <p className="section-title">🤖 AI 異物推定（一次判定）</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
              <p className="text-yellow-700 text-xs font-medium">
                ⚠️ ルールベース推定支援。確定には外部分析機関の鑑定が必要です。
              </p>
            </div>
            <div className="space-y-4">
              {incident.estimations.map((est, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${URGENCY_CLASS[est.urgency]}`}>
                        {URGENCY_LABEL[est.urgency]}
                      </span>
                      <span className={`font-bold ${i === 0 ? 'text-gray-800 text-base' : 'text-gray-600 text-sm'}`}>
                        {est.category}
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
                    <div className="flex flex-wrap gap-1.5">
                      {est.basis.map((b, j) => (
                        <span key={j}
                          className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 font-medium">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 外部クレーム情報 */}
        {incident.occurrenceType === 'external' && (
          <div className="card p-4 border-l-4 border-purple-400">
            <p className="section-title">
              📦 外部クレーム情報
              <span className="ml-2 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {OCCURRENCE_TYPE_LABELS['external']}
              </span>
            </p>
            <dl className="space-y-2.5">
              {incident.claimSource && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">クレーム元</dt>
                  <dd className="text-sm text-gray-800 font-medium">{incident.claimSource}</dd>
                </div>
              )}
              {incident.claimDate && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">受付日</dt>
                  <dd className="text-sm text-gray-800 font-medium">{incident.claimDate}</dd>
                </div>
              )}
              {incident.claimRoute && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">クレーム経路</dt>
                  <dd className="text-sm text-gray-800 font-medium">{CLAIM_ROUTE_LABELS[incident.claimRoute]}</dd>
                </div>
              )}
              {incident.claimContent && (
                <div className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">クレーム内容</dt>
                  <dd className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{incident.claimContent}</dd>
                </div>
              )}
            </dl>
            {/* クレーム写真 */}
            {incident.claimPhotos && incident.claimPhotos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 font-semibold mb-2">クレーム写真</p>
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
          <p className="section-title">📦 商品情報</p>
          <dl className="space-y-2.5">
            {[
              { label: '商品名', value: incident.productName },
              { label: 'ロット番号', value: incident.lotNumber },
              { label: '製造日', value: formatDate(incident.manufacturingDate) },
              { label: '賞味・消費期限', value: formatDate(incident.expiryDate) },
              { label: 'ライン番号', value: incident.lineNumber },
              { label: '工場名', value: incident.factory },
              { label: '担当者', value: incident.operator },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex items-start gap-3">
                  <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-sm text-gray-800 font-medium">{value}</dd>
                </div>
              ) : null
            )}
            <div className="flex items-start gap-3">
              <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">発見工程</dt>
              <dd className="text-sm text-gray-800 font-medium">
                {DISCOVERY_PROCESS_LABELS[incident.discoveryProcess]}
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <dt className="text-xs text-gray-400 font-semibold w-28 shrink-0 pt-0.5">発見日時</dt>
              <dd className="text-sm text-gray-800 font-medium">{formatDateTime(incident.discoveryDate)}</dd>
            </div>
          </dl>
        </div>

        {/* 写真 */}
        {(incident.photos.length > 0 || incident.microscopePhotos.length > 0) && (
          <div className="card p-4">
            <p className="section-title">📷 写真</p>
            {incident.photos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">通常写真</p>
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
                <p className="text-xs text-gray-500 font-semibold mb-2">顕微鏡写真</p>
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
          <p className="section-title">🔍 異物特徴チェック結果</p>
          <FeatureSummary features={incident.features} />
        </div>

        {/* 対応記録 */}
        {(incident.comment || incident.correctiveAction || incident.preventiveMeasure) && (
          <div className="card p-4">
            <p className="section-title">📝 対応記録</p>
            <div className="space-y-3">
              {incident.comment && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">状況コメント</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.comment}</p>
                </div>
              )}
              {incident.correctiveAction && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">是正処置</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.correctiveAction}</p>
                </div>
              )}
              {incident.preventiveMeasure && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">再発防止策</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{incident.preventiveMeasure}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 是正処置 PDCA */}
        <div className="card p-4 no-print">
          <p className="section-title">🔄 是正処置 PDCA 進捗</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(['planned', 'doing', 'checking', 'done'] as PdcaStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setPdcaStatus(s)}
                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  pdcaStatus === s ? PDCA_STATUS_COLORS[s] : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                }`}>
                {PDCA_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="space-y-2 mb-3">
            <div>
              <label className="label">期限日</label>
              <input type="date" value={pdcaDeadline} onChange={(e) => setPdcaDeadline(e.target.value)}
                className="input-field" />
            </div>
            <div>
              <label className="label">PDCA メモ（進捗・担当者・次のアクション）</label>
              <textarea value={pdcaNotes} onChange={(e) => setPdcaNotes(e.target.value)}
                rows={3} className="input-field resize-none"
                placeholder="例: 2026-06-01 山田が原因調査実施。2026-06-10 全ライン点検予定。" />
            </div>
          </div>
          <button onClick={handleSavePdca} disabled={savingPdca}
            className="w-full py-3 bg-indigo-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-600 transition-all">
            {savingPdca ? '保存中...' : '💾 PDCA状況を保存'}
          </button>
        </div>

        {/* AI 報告書・エクスポート */}
        <div className="card p-4 no-print">
          <p className="section-title">📄 AI報告書・データエクスポート</p>
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
                  toast.success('AI報告書を生成しました 📄')
                  router.push(`/report/${reportId}`)
                } catch { toast.error('生成に失敗しました') }
                finally { setGeneratingReport(false) }
              }}
              disabled={generatingReport}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-sm shadow-md shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-xl">📝</span>
              {generatingReport ? 'AI報告書を生成中...' : 'AI クレーム報告書を自動生成・保存'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const html = reportToWordHTML(`クレーム報告書 - ${incident.productName}`, generateIncidentReport(incident))
                  const blob = new Blob([html], { type: 'application/msword' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `クレーム報告書_${incident.productName}.doc`; a.click()
                  URL.revokeObjectURL(url)
                  toast.success('Word文書をダウンロードしました 📘')
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-blue-100 text-blue-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-blue-200"
              >
                <span>📘</span> Word (.doc)
              </button>
              <button
                onClick={() => {
                  const csv = incidentToCSV(incident)
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `異物事故_${incident.productName}_${incident.lotNumber}.csv`; a.click()
                  URL.revokeObjectURL(url)
                  toast.success('Excelデータをダウンロードしました 📗')
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-green-100 text-green-700 font-bold text-xs transition-all active:scale-[0.98] hover:bg-green-200"
              >
                <span>📗</span> Excel (.csv)
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          登録: {formatDateTime(incident.createdAt)} / 更新: {formatDateTime(incident.updatedAt)}
        </p>

        <button onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3.5 text-red-500 hover:text-red-600 text-sm border border-red-200 hover:border-red-400 rounded-2xl transition-all bg-red-50/50 hover:bg-red-50 font-semibold no-print">
          🗑️ この記録を削除
        </button>
      </div>

      <Navigation />
    </div>
  )
}

function FeatureSummary({ features }: { features: Incident['features'] }) {
  const tags: string[] = []
  if (features.texture.hard) tags.push('固い')
  if (features.texture.soft) tags.push('柔らかい')
  if (features.texture.elastic) tags.push('弾力あり')
  if (features.texture.crumbly) tags.push('崩れやすい')
  if (features.texture.sticky) tags.push('粘着あり')
  if (features.appearance.glossy) tags.push('光沢')
  if (features.appearance.translucent) tags.push('半透明')
  if (features.appearance.burned) tags.push('焦げ')
  if (features.appearance.fibrous) tags.push('繊維状')
  if (features.appearance.granular) tags.push('粒状')
  if (features.appearance.layered) tags.push('層構造')
  if (features.appearance.bubbly) tags.push('気泡あり')
  if (features.appearance.metallic) tags.push('金属感')
  if (features.color.black) tags.push('黒色')
  if (features.color.brown) tags.push('茶色')
  if (features.color.white) tags.push('白色')
  if (features.color.metalColor) tags.push('金属色')
  if (features.color.transparent) tags.push('透明')
  if (features.color.green) tags.push('緑色')
  if (features.smell.burnedSmell) tags.push('焦げ臭')
  if (features.smell.oilSmell) tags.push('油臭')
  if (features.smell.chemicalSmell) tags.push('薬品臭')
  if (features.smell.noSmell) tags.push('無臭')
  if (features.waterTest.floats) tags.push('水に浮く')
  if (features.waterTest.sinks) tags.push('水に沈む')
  if (features.waterTest.dissolves) tags.push('溶ける')
  if (features.waterTest.oilSurface) tags.push('油浮き')

  if (tags.length === 0) return <p className="text-sm text-gray-400">特徴チェックなし</p>

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
