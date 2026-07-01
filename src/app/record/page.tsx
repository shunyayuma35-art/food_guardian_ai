'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { createIncident } from '@/lib/firestore'
import { uploadPhotos } from '@/lib/storage'
import { estimateForeignMaterial } from '@/lib/estimation'
import { parseQRCode } from '@/lib/utils'
import {
  createEmptyFeatures,
  DISCOVERY_PROCESS_LABELS,
  CLAIM_ROUTE_LABELS,
  OCCURRENCE_TYPE_LABELS,
  type DiscoveryProcess,
  type OccurrenceType,
  type ClaimRoute,
} from '@/lib/types'
import Navigation from '@/components/Navigation'
import QRScanner from '@/components/QRScanner'
import PhotoUpload from '@/components/PhotoUpload'
import FeatureChecklistComponent from '@/components/FeatureChecklist'
import UsageGuide from '@/components/UsageGuide'
import toast from 'react-hot-toast'

const STEP_ICONS = ['📦', '📸', '🔍', '📝']

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
    toast.success('📱 QRコードを読み込みました')
  }, [])

  async function handleSubmit() {
    if (!user) return
    if (!lotNumber.trim() && !productName.trim()) {
      toast.error('商品名またはロット番号を入力してください')
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
      toast.success('✅ 登録完了しました')
      router.push(`/record/${id}`)
    } catch (err) {
      console.error(err)
      toast.error('登録に失敗しました')
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
              title="📖 異物登録の手順"
              color="orange"
              steps={[
                { icon: '📌', title: `STEP 1｜${t('record.step.product')}`, desc: '発生区分（社内発見 or お客様クレーム）を選び、製品名・ロット番号を入力します。' },
                { icon: '📸', title: `STEP 2｜${t('record.step.photo')}`, desc: '異物の写真を撮ります。定規やコインを一緒に撮ると大きさが分かりやすくなります。' },
                { icon: '🔍', title: `STEP 3｜${t('record.step.features')}`, desc: '触感・見た目・色・におい・水試験の項目から、当てはまるものを全てチェックします。' },
                { icon: '📝', title: `STEP 4｜${t('record.step.detail')}`, desc: '発見工程・発見日時・是正処置・再発防止策を入力して登録ボタンを押します。' },
              ]}
              tips={[
                'ロット番号は必ず入力してください（後でトレース検索に使います）',
                'AI推定はあくまで参考です。確定には外部機関の鑑定が必要です',
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
                    internal: { icon: '🏭', desc: '工場内で発見した異物', activeClass: 'bg-orange-500 border-orange-500 text-white shadow-orange-200' },
                    external: { icon: '📦', desc: '店舗・消費者からのクレーム', activeClass: 'bg-purple-500 border-purple-500 text-white shadow-purple-200' },
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
                      <div>{OCCURRENCE_TYPE_LABELS[type]}</div>
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
              <p className="text-blue-600 text-xs font-bold">📷 撮影ポイント</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                {t('record.featureHint').replace('特徴を選択すると', '定規やコインを一緒に撮影するとサイズが分かりやすくなります。顕微鏡写真は')}
              </p>
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
            <div className="border-t border-orange-100" />
            <PhotoUpload label={t('record.microscopePhoto')} photos={microscopePhotos} onChange={setMicroscopePhotos} icon="🔬" />
          </div>
        )}

        {/* ━━ Step 2: 異物特徴 ━━ */}
        {step === 2 && (
          <div>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-5">
              <p className="text-orange-600 text-xs font-bold">💡 {t('record.featureHint')}</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                触感・見た目・色・におい・水試験で該当するものをすべて選んでください
              </p>
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
