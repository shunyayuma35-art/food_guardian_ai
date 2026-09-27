'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { createIncident } from '@/lib/firestore'
import { uploadPhotos } from '@/lib/storage'
import { estimateForeignMaterial } from '@/lib/estimation'
import { compressImage } from '@/lib/compressImage'
import { parseQRCode } from '@/lib/utils'
import {
  createEmptyFeatures,
  DISCOVERY_PROCESS_LABELS,
  CLAIM_ROUTE_LABELS,
  type DiscoveryProcess,
  type OccurrenceType,
  type ClaimRoute,
} from '@/lib/types'
import Navigation from '@/components/Navigation'
import QRScanner from '@/components/QRScanner'
import PhotoUpload from '@/components/PhotoUpload'
import FeatureChecklistComponent from '@/components/FeatureChecklist'
import UsageGuide from '@/components/UsageGuide'
import ForensicEnhancer from '@/components/ForensicEnhancer'
import toast from 'react-hot-toast'

const STEP_ICONS = ['📦', '📸', '🔍', '📝']

function getStoredLang(): string {
  if (typeof window === 'undefined') return 'ja'
  return localStorage.getItem('foodeye_lang') ?? 'ja'
}

export default function RecordPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const STEPS = [t('record.step.product'), t('record.step.photo'), t('record.step.features'), t('record.step.detail')]

  const [step, setStep] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [occurrenceType, setOccurrenceType] = useState<OccurrenceType>('internal')

  const [productName, setProductName] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [lineNumber, setLineNumber] = useState('')
  const [factory, setFactory] = useState('')
  const [operator, setOperator] = useState('')

  const [claimSource, setClaimSource] = useState('')
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [claimContent, setClaimContent] = useState('')
  const [claimRoute, setClaimRoute] = useState<ClaimRoute>('consumer_to_store')
  const [claimPhotos, setClaimPhotos] = useState<File[]>([])

  const [photos, setPhotos] = useState<File[]>([])
  const [microscopePhotos, setMicroscopePhotos] = useState<File[]>([])
  const [features, setFeatures] = useState(createEmptyFeatures())

  interface AiQuickResult {
    name: string
    category: string
    confidence: string
    urgency: 'high' | 'medium' | 'low'
    size_estimate?: string
    color?: string[]
    shape?: string[]
    magnet?: string
    route?: string[]
    action?: string
    colorKeys?: string[]
    textureKeys?: string[]
    appearanceKeys?: string[]
    sizeKey?: string
  }

  const [aiQuickResult, setAiQuickResult] = useState<AiQuickResult | null>(null)
  const [aiEstimating, setAiEstimating] = useState(false)

  // 異物写真がアップロードされたら自動でAI即時判定
  useEffect(() => {
    const file = photos[0]
    if (!file) { setAiQuickResult(null); return }

    let cancelled = false
    setAiEstimating(true)
    setAiQuickResult(null)

    ;(async () => {
      // canvas で圧縮（EXIF 回転補正あり）→ API 送信
      let base64: string
      let mediaType = 'image/jpeg'
      try {
        const compressed = await compressImage(file)
        base64 = compressed.base64
        mediaType = compressed.mimeType
      } catch {
        // 圧縮失敗時は FileReader でフォールバック
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = e => resolve(e.target?.result as string)
          r.onerror = reject
          r.readAsDataURL(file)
        })
        base64 = dataUrl.split(',')[1]
        mediaType = file.type || 'image/jpeg'
      }

      if (cancelled) return

      try {
        const res = await fetch('/api/analyze-foreign-matter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType, structured: true, lang: getStoredLang() }),
        })
        if (cancelled) return
        if (res.status === 429) return
        const data = await res.json()
        if (!res.ok) return
        if (data.quickResult) {
          if (!cancelled) setAiQuickResult(data.quickResult as AiQuickResult)
        }
      } catch {
        // ネットワークエラーは静かに無視
      } finally {
        if (!cancelled) setAiEstimating(false)
      }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos[0]?.name, photos[0]?.size])

  function applyAIToFeatures() {
    if (!aiQuickResult) return
    setFeatures(prev => {
      const next = {
        texture:  { ...prev.texture },
        appearance: { ...prev.appearance },
        color:    { ...prev.color },
        smell:    { ...prev.smell },
        waterTest: { ...prev.waterTest },
        size:     { ...prev.size },
        magnetTest: { ...prev.magnetTest },
        weight:   { ...prev.weight },
      }
      aiQuickResult.colorKeys?.forEach(k => { if (k in next.color) (next.color as Record<string, boolean>)[k] = true })
      aiQuickResult.textureKeys?.forEach(k => { if (k in next.texture) (next.texture as Record<string, boolean>)[k] = true })
      aiQuickResult.appearanceKeys?.forEach(k => { if (k in next.appearance) (next.appearance as Record<string, boolean>)[k] = true })
      if (aiQuickResult.sizeKey && aiQuickResult.sizeKey in next.size) {
        (next.size as Record<string, boolean>)[aiQuickResult.sizeKey] = true
      }
      // 磁石反応の自動入力
      if (aiQuickResult.magnet === '磁石につく') {
        next.magnetTest.sticks = true; next.magnetTest.notTested = false
      } else if (aiQuickResult.magnet === '磁石につかない') {
        next.magnetTest.noStick = true; next.magnetTest.notTested = false
      }
      return next
    })
    toast.success(t('toast.aiApplied'))
  }

  const [discoveryProcess, setDiscoveryProcess] = useState<DiscoveryProcess>('after_packaging')
  const [discoveryDate, setDiscoveryDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [comment, setComment] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveMeasure, setPreventiveMeasure] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  const handleQRScan = useCallback((text: string) => {
    setShowQR(false)
    const parsed = parseQRCode(text)
    if (parsed.productName) setProductName(parsed.productName)
    if (parsed.lotNumber) setLotNumber(parsed.lotNumber)
    if (parsed.manufacturingDate) setManufacturingDate(parsed.manufacturingDate)
    if (parsed.expiryDate) setExpiryDate(parsed.expiryDate)
    if (parsed.lineNumber) setLineNumber(parsed.lineNumber)
    if (parsed.factory) setFactory(parsed.factory)
    toast.success('📱 ' + t('toast.qrRead'))
  }, [])

  async function handleSubmit() {
    if (!user) return
    if (!lotNumber.trim() && !productName.trim()) {
      toast.error(t('toast.fillNameOrLot'))
      setStep(0)
      return
    }
    setSubmitting(true)
    try {
      const [photoURLs, microscopeURLs, claimPhotoURLs] = await Promise.all([
        uploadPhotos(user.uid, photos),
        uploadPhotos(user.uid, microscopePhotos),
        uploadPhotos(user.uid, claimPhotos),
      ])
      const estimations = estimateForeignMaterial(features, discoveryProcess)
      const id = await createIncident({
        productName, lotNumber, manufacturingDate, expiryDate,
        lineNumber, factory, operator,
        discoveryDate: new Date(discoveryDate).toISOString(),
        discoveryProcess,
        photos: photoURLs,
        microscopePhotos: microscopeURLs,
        comment, features, estimations,
        correctiveAction, preventiveMeasure,
        status: 'open',
        createdBy: user.uid,
        occurrenceType,
        ...(occurrenceType === 'external' ? {
          claimSource, claimDate, claimContent, claimRoute,
          claimPhotos: claimPhotoURLs,
        } : {}),
      })
      toast.success('✅ ' + t('toast.saved'))
      router.push(`/record/${id}`)
    } catch (err) {
      console.error(err)
      toast.error(t('toast.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      {showQR && <QRScanner onScan={handleQRScan} onClose={() => setShowQR(false)} />}

      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : router.push('/'))}
            className="back-btn"
            aria-label={t('common.back')}
          >
            ←
          </button>
          <h1 className="font-extrabold text-gray-800 text-base">{t('record.title')}</h1>
          <span className="text-sm font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="max-w-2xl mx-auto mt-3">
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    i < step
                      ? 'bg-orange-400'
                      : i === step
                      ? 'bg-gradient-to-r from-orange-400 to-rose-400 shadow-sm shadow-orange-200'
                      : 'bg-orange-100'
                  }`}
                />
                <p className={`text-[10px] mt-1 text-center font-semibold ${
                  i === step ? 'text-orange-500' : i < step ? 'text-orange-400' : 'text-gray-400'
                }`}>
                  {STEP_ICONS[i]} {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5">

        {step === 0 && (
          <div className="mb-4">
            <UsageGuide
              title={t('guide.record')}
              color="orange"
              steps={[
                { icon: '📌', title: `STEP 1｜${t('record.step.product')}`, desc: t('record.guide.step1.desc') },
                { icon: '📸', title: `STEP 2｜${t('record.step.photo')}`, desc: t('record.guide.step2.desc') },
                { icon: '🔍', title: `STEP 3｜${t('record.step.features')}`, desc: t('record.guide.step3.desc') },
                { icon: '📝', title: `STEP 4｜${t('record.step.detail')}`, desc: t('record.guide.step4.desc') },
              ]}
              tips={[
                t('record.guide.tip1'),
                t('record.guide.tip2'),
              ]}
            />
          </div>
        )}

        {/* ━━ Step 0: 商品情報 ━━ */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">📌 {t('record.occurrenceType')} <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-2 gap-3">
                {(['internal', 'external'] as OccurrenceType[]).map((type) => {
                  const cfg = {
                    internal: { icon: '🏭', desc: t('record.internal.desc'), activeClass: 'bg-orange-500 border-orange-500 text-white shadow-orange-200' },
                    external: { icon: '📦', desc: t('record.external.desc'), activeClass: 'bg-purple-500 border-purple-500 text-white shadow-purple-200' },
                  }[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setOccurrenceType(type)}
                      className={`py-4 rounded-2xl border-2 font-bold text-sm transition-all active:scale-95 ${
                        occurrenceType === type
                          ? `shadow-md ${cfg.activeClass}`
                          : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{cfg.icon}</div>
                      <div>{type === 'internal' ? t('record.occurrenceType.internal') : t('record.occurrenceType.external')}</div>
                      <p className={`text-[10px] mt-0.5 font-normal ${occurrenceType === type ? 'text-white/80' : 'text-gray-400'}`}>
                        {cfg.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {occurrenceType === 'external' && (
              <div className="card p-4 border-l-4 border-purple-400 space-y-3">
                <p className="text-xs font-bold text-purple-700 mb-1">📋 {t('record.claimInfo')}</p>
                <div>
                  <label className="label">{t('record.claimSource')} <span className="text-red-400">*</span></label>
                  <input value={claimSource} onChange={(e) => setClaimSource(e.target.value)}
                    className="input-field" placeholder="例: ○○スーパー 渋谷店 / 株式会社△△フーズ" />
                </div>
                <div>
                  <label className="label">{t('record.claimDate')} <span className="text-red-400">*</span></label>
                  <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)}
                    className="input-field" />
                </div>
                <div>
                  <label className="label">{t('record.claimContent')}</label>
                  <textarea value={claimContent} onChange={(e) => setClaimContent(e.target.value)}
                    rows={3} className="input-field resize-none"
                    placeholder="消費者・取引先からの申告内容など" />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowQR(true)}
              className="w-full py-5 bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500
                         text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all
                         shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 text-base active:scale-[0.98]"
            >
              <span className="text-3xl">📱</span>
              {t('record.scanQR')}
            </button>
            <p className="text-xs text-gray-500 text-center -mt-2">{t('record.qrHint')}</p>

            <div>
              <label className="label">{t('record.productName')}</label>
              <input value={productName} onChange={(e) => setProductName(e.target.value)}
                className="input-field" placeholder="例: 〇〇弁当 のり塩から揚げ" />
            </div>
            <div>
              <label className="label">{t('record.lotNo')} <span className="text-orange-500">*</span></label>
              <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                className="input-field" placeholder="例: L2024-0512-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('record.mfgDate')}</label>
                <input type="date" value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">{t('record.expiryDate')}</label>
                <input type="date" value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('record.lineNo')}</label>
                <input value={lineNumber} onChange={(e) => setLineNumber(e.target.value)}
                  className="input-field" placeholder="例: L-03" />
              </div>
              <div>
                <label className="label">{t('record.factory')}</label>
                <input value={factory} onChange={(e) => setFactory(e.target.value)}
                  className="input-field" placeholder="例: 〇〇工場" />
              </div>
            </div>
            <div>
              <label className="label">{t('record.operator')}</label>
              <input value={operator} onChange={(e) => setOperator(e.target.value)}
                className="input-field" placeholder="例: 山田 太郎" />
            </div>
          </div>
        )}

        {/* ━━ Step 1: 写真 ━━ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-blue-600 text-xs font-bold">📷 {t('record.step.photo')}</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">{t('record.photoHint')}</p>
            </div>

            {occurrenceType === 'external' && (
              <div className="border-l-4 border-purple-400 pl-3">
                <PhotoUpload
                  label={t('record.claimPhoto')}
                  photos={claimPhotos}
                  onChange={setClaimPhotos}
                  icon="📦"
                />
              </div>
            )}

            <PhotoUpload label={t('record.normalPhoto')} photos={photos} onChange={setPhotos} icon="📸" />

            {/* ── AI即時判定カード ── */}
            {aiEstimating && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl text-sm text-orange-600 font-semibold">
                <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin shrink-0" />
                {t('record.ai.estimating')}
              </div>
            )}
            {aiQuickResult && !aiEstimating && (() => {
              const urgencyMap = {
                high:   { label: '🔴 高', bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700' },
                medium: { label: '🟡 中', bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700' },
                low:    { label: '🟢 低', bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700' },
              }
              const u = urgencyMap[aiQuickResult.urgency] ?? urgencyMap.medium
              return (
                <div className={`rounded-2xl border-2 ${u.border} ${u.bg} p-4 space-y-3 shadow-sm`}>
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 tracking-wide">{t('record.ai.quickTitle')}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${u.border} ${u.text}`}>
                      {u.label}
                    </span>
                  </div>

                  {/* 異物名 */}
                  <div>
                    <p className={`text-lg font-extrabold ${u.text} leading-tight`}>
                      {aiQuickResult.name}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="font-semibold">{aiQuickResult.category}</span>
                      　{t('record.ai.confidence')}<span className="font-bold">{aiQuickResult.confidence}</span>
                    </p>
                  </div>

                  {/* サイズ・緊急度 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/70 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{t('record.ai.sizeLabel')}</p>
                      <p className="text-sm font-bold text-gray-800">{aiQuickResult.size_estimate || t('record.ai.unknown')}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{t('record.ai.urgencyLabel')}</p>
                      <p className={`text-sm font-bold ${u.text}`}>{u.label}</p>
                    </div>
                  </div>

                  {/* 混入経路 */}
                  {aiQuickResult.route && aiQuickResult.route.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-1">{t('record.ai.routeLabel')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiQuickResult.route.map((r, i) => (
                          <span key={i} className="text-xs bg-white border border-gray-200 text-gray-700 rounded-full px-2.5 py-0.5 font-medium">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 磁石反応 */}
                  {aiQuickResult.magnet && aiQuickResult.magnet !== '不明' && (
                    <p className="text-xs text-gray-600">🧲 {aiQuickResult.magnet}</p>
                  )}

                  {/* 推奨対応 */}
                  {aiQuickResult.action && (
                    <div className="bg-white/70 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{t('record.ai.actionLabel')}</p>
                      <p className="text-xs text-gray-700 font-medium">{aiQuickResult.action}</p>
                    </div>
                  )}

                  {/* 特徴を自動入力ボタン */}
                  <button
                    type="button"
                    onClick={applyAIToFeatures}
                    className="w-full py-2 text-xs font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 active:scale-95 transition-all"
                  >
                    {t('record.ai.applyBtn')}
                  </button>

                  <p className="text-[9px] text-gray-400 text-center">
                    {t('record.ai.disclaimer')}
                  </p>
                </div>
              )
            })()}

            {/* 鑑識画像解析 – 異物写真がある場合に表示 */}
            {photos.length > 0 && (
              <ForensicEnhancer file={photos[0]} />
            )}

            <div className="border-t border-orange-100" />
            <PhotoUpload label={t('record.microscopePhoto')} photos={microscopePhotos} onChange={setMicroscopePhotos} icon="🔬" />

            {/* 顕微鏡写真の鑑識解析 */}
            {microscopePhotos.length > 0 && (
              <ForensicEnhancer file={microscopePhotos[0]} />
            )}
          </div>
        )}

        {/* ━━ Step 2: 異物特徴 ━━ */}
        {step === 2 && (
          <div>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-5">
              <p className="text-orange-600 text-xs font-bold">💡 {t('record.featureHint')}</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">{t('record.featureSubhint')}</p>
            </div>
            <FeatureChecklistComponent value={features} onChange={setFeatures} />
          </div>
        )}

        {/* ━━ Step 3: 詳細情報 ━━ */}
        {step === 3 && (
          <div className="space-y-4">
            {occurrenceType === 'external' && (
              <div className="card p-4 border-l-4 border-purple-400">
                <label className="label">{t('record.claimRoute')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(CLAIM_ROUTE_LABELS) as [ClaimRoute, string][]).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setClaimRoute(key)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                        claimRoute === key
                          ? 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-200'
                          : 'bg-white border-purple-200 text-gray-600 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">{t('record.discoveryProcess')}</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(DISCOVERY_PROCESS_LABELS) as [DiscoveryProcess, string][]).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setDiscoveryProcess(key)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                      discoveryProcess === key
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200'
                        : 'bg-white border-orange-200 text-gray-600 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t('record.discoveryDate')}</label>
              <input type="datetime-local" value={discoveryDate}
                onChange={(e) => setDiscoveryDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">{t('record.comment')}</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                rows={3} className="input-field resize-none"
                placeholder="異物の発見状況、大きさ、特記事項など" />
            </div>
            <div>
              <label className="label">{t('record.corrective')}</label>
              <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)}
                rows={2} className="input-field resize-none"
                placeholder="実施した即時対応（例: 当該ライン停止・全数点検）" />
            </div>
            <div>
              <label className="label">{t('record.preventive')}</label>
              <textarea value={preventiveMeasure} onChange={(e) => setPreventiveMeasure(e.target.value)}
                rows={2} className="input-field resize-none" placeholder="計画する再発防止措置" />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-orange-100 p-4 no-print shadow-[0_-4px_20px_rgba(251,146,60,0.08)]">
        <div className="max-w-2xl mx-auto flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="back-btn shrink-0" aria-label={t('common.back')}>
              ←
            </button>
          )}
          <div className="flex-1">
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary w-full text-base">
                {t('common.next')}：{STEP_ICONS[step + 1]} {STEPS[step + 1]} →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="btn-primary w-full text-base disabled:opacity-50">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('record.submitting')}
                  </span>
                ) : (
                  t('record.submit')
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
