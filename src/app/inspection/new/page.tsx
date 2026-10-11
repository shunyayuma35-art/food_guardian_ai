'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { v4 as uuidv4 } from 'uuid'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import { createInspectionRecord } from '@/lib/firestore'
import toast from 'react-hot-toast'
import DateInput from '@/components/DateInput'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'
import { formatLocalDate } from '@/lib/utils'
import {
  DEVICE_TYPE_LABELS,
  INSPECTION_RESULT_LABELS,
  type DeviceType,
  type InspectionResult,
  type TestPieceCheck,
} from '@/lib/types'

const today = () => formatLocalDate()
const nowTime = () => new Date().toTimeString().slice(0, 5)

function emptyCheck(time: string): TestPieceCheck {
  return { time, fePassed: null, susPassed: null, nonFePassed: null, passed: true }
}

function CheckBtn({
  label, value, onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-14 shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
          value === true
            ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200'
            : 'bg-white border-gray-200 text-gray-500 hover:border-green-400'
        }`}
      >
        ✅ OK
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
          value === false
            ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-200'
            : 'bg-white border-gray-200 text-gray-500 hover:border-red-400'
        }`}
      >
        ❌ NG
      </button>
    </div>
  )
}

export default function InspectionNewPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [deviceType, setDeviceType] = useState<DeviceType>('metal_detector')
  const [deviceName, setDeviceName] = useState('')
  const [lineNumber, setLineNumber] = useState('')
  const [factory, setFactory] = useState('')
  const [productName, setProductName] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [inspectionDate, setInspectionDate] = useState(today)
  const [inspector, setInspector] = useState('')

  const [feSens, setFeSens] = useState('')
  const [susSens, setSusSens] = useState('')
  const [nonFeSens, setNonFeSens] = useState('')
  const [xrayThreshold, setXrayThreshold] = useState('')

  const [startCheck, setStartCheck] = useState<TestPieceCheck>(() => emptyCheck(nowTime()))
  const [endCheck, setEndCheck] = useState<TestPieceCheck>(() => emptyCheck(nowTime()))

  const [rejectCount, setRejectCount] = useState(0)
  const [rejectDetails, setRejectDetails] = useState('')
  const [result, setResult] = useState<InspectionResult>('pass')
  const [correctionAction, setCorrectionAction] = useState('')
  const [comment, setComment] = useState('')

  function updateCheck(
    target: 'start' | 'end',
    field: keyof TestPieceCheck,
    value: boolean | string
  ) {
    const setter = target === 'start' ? setStartCheck : setEndCheck
    setter((prev) => {
      const next = { ...prev, [field]: value }
      const checks = [next.fePassed, next.susPassed, next.nonFePassed].filter((v) => v !== null)
      next.passed = checks.length === 0 || checks.every(Boolean)
      return next
    })
  }

  async function handleSubmit() {
    if (!user) return
    if (!deviceName.trim()) { toast.error(t('toast.enterDeviceName')); return }
    if (!inspector.trim()) { toast.error(t('toast.enterInspector')); return }

    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      const id = uuidv4()
      await createInspectionRecord({
        deviceType,
        deviceName: deviceName.trim(),
        lineNumber: lineNumber.trim(),
        factory: factory.trim(),
        sensitivity: {
          fe: feSens.trim() || undefined,
          sus: susSens.trim() || undefined,
          nonFe: nonFeSens.trim() || undefined,
          xrayThreshold: xrayThreshold.trim() || undefined,
        },
        productName: productName.trim(),
        lotNumber: lotNumber.trim(),
        inspectionDate,
        inspector: inspector.trim(),
        startCheck,
        endCheck,
        rejectCount,
        rejectDetails: rejectDetails.trim() || undefined,
        result,
        correctionAction: correctionAction.trim() || undefined,
        comment: comment.trim() || undefined,
        createdBy: user.uid,
      })

      toast.success('✅ ' + t('toast.inspSaved'))
      router.push(`/inspection/${id}`)
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
        <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isMetal = deviceType === 'metal_detector'

  return (
    <div className="min-h-screen">
      <header className="bg-white/85 backdrop-blur-xl border-b border-teal-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/inspection')} className="back-btn">←</button>
          <h1 className="font-extrabold text-gray-800 text-base">{t('insp.title')}</h1>
          <span className="text-xs text-teal-600 bg-teal-50 font-bold px-3 py-1 rounded-full">
            {DEVICE_TYPE_LABELS[deviceType]}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">

        <UsageGuide
          title={t('guide.insp')}
          color="teal"
          steps={[
            { icon: '🔧', title: t('insp.deviceType'), desc: t('insp.new.step1.desc') },
            { icon: '⚙️', title: t('insp.sensitivity'), desc: t('insp.new.step2.desc') },
            { icon: '📦', title: t('insp.productInfo'), desc: t('insp.new.step3.desc') },
            { icon: '🟢', title: t('insp.startCheck'), desc: t('insp.new.step4.desc') },
            { icon: '🔴', title: t('insp.endCheck'), desc: t('insp.new.step5.desc') },
            { icon: '📋', title: t('insp.overallResult'), desc: t('insp.new.step6.desc') },
          ]}
          tips={[
            t('insp.new.tip1'),
            t('insp.new.tip2'),
          ]}
        />

        {/* 機器種別 */}
        <div className="card p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">🔧 {t('insp.deviceType')} <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-2 gap-3">
            {(['metal_detector', 'xray'] as DeviceType[]).map((type) => {
              const cfg = {
                metal_detector: { icon: '🧲', desc: t('insp.metalDesc') },
                xray: { icon: '☢️', desc: t('insp.xrayDesc') },
              }[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDeviceType(type)}
                  className={`py-4 rounded-2xl border-2 font-bold text-sm transition-all ${
                    deviceType === type
                      ? 'bg-teal-500 border-teal-500 text-white shadow-md shadow-teal-200'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{cfg.icon}</div>
                  <div>{DEVICE_TYPE_LABELS[type]}</div>
                  <p className={`text-[10px] mt-0.5 font-normal ${deviceType === type ? 'text-white/80' : 'text-gray-400'}`}>
                    {cfg.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 機器・ライン情報 */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">🏭 {t('insp.deviceInfo')}</p>
          <div>
            <label className="label">{t('insp.deviceName')} <span className="text-red-400">*</span></label>
            <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)}
              className="input-field" placeholder="例: 1号金属探知機 / X線検査機-A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('record.lineNo')}</label>
              <input value={lineNumber} onChange={(e) => setLineNumber(e.target.value)}
                className="input-field" placeholder="例: 1ライン" />
            </div>
            <div>
              <label className="label">{t('record.factory')}</label>
              <input value={factory} onChange={(e) => setFactory(e.target.value)}
                className="input-field" placeholder="例: 第1工場" />
            </div>
          </div>
        </div>

        {/* 感度設定 */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">⚙️ {t('insp.sensitivity')}</p>
          {isMetal ? (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">{t('insp.feLabel')}</label>
                <input value={feSens} onChange={(e) => setFeSens(e.target.value)}
                  className="input-field text-sm" placeholder="φ1.5mm" />
              </div>
              <div>
                <label className="label">{t('insp.susLabel')}</label>
                <input value={susSens} onChange={(e) => setSusSens(e.target.value)}
                  className="input-field text-sm" placeholder="φ2.0mm" />
              </div>
              <div>
                <label className="label">Non-Fe</label>
                <input value={nonFeSens} onChange={(e) => setNonFeSens(e.target.value)}
                  className="input-field text-sm" placeholder="φ2.0mm" />
              </div>
            </div>
          ) : (
            <div>
              <label className="label">{t('insp.xrayThreshold')}</label>
              <input value={xrayThreshold} onChange={(e) => setXrayThreshold(e.target.value)}
                className="input-field" placeholder="例: Fe 1.0mm / SUS 1.5mm / 骨 2.0mm" />
            </div>
          )}
        </div>

        {/* 製品情報 */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">📦 {t('insp.productInfo')}</p>
          <div>
            <label className="label">{t('insp.productName')}</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)}
              className="input-field" placeholder="例: 万能ごま 220g" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('record.lotNo')}</label>
              <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                className="input-field" placeholder="例: L2024-001" />
            </div>
            <div>
              <label className="label">{t('insp.date')}</label>
              <DateInput value={inspectionDate} onChange={setInspectionDate} />
            </div>
          </div>
          <div>
            <label className="label">{t('insp.inspector')} <span className="text-red-400">*</span></label>
            <input value={inspector} onChange={(e) => setInspector(e.target.value)}
              className="input-field" placeholder="例: 山田 太郎" />
          </div>
        </div>

        {/* 始業テストピース確認 */}
        <div className="card p-4 space-y-3 border-l-4 border-teal-400">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-teal-700">🟢 {t('insp.startCheck')}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              startCheck.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {startCheck.passed ? t('insp.pass') : t('insp.fail')}
            </span>
          </div>
          <div>
            <label className="label">{t('insp.checkTime')}</label>
            <input type="time" value={startCheck.time}
              onChange={(e) => updateCheck('start', 'time', e.target.value)}
              className="input-field" />
          </div>
          {isMetal ? (
            <div className="space-y-2">
              <CheckBtn label="Fe" value={startCheck.fePassed}
                onChange={(v) => updateCheck('start', 'fePassed', v)} />
              <CheckBtn label="SUS" value={startCheck.susPassed}
                onChange={(v) => updateCheck('start', 'susPassed', v)} />
              <CheckBtn label="Non-Fe" value={startCheck.nonFePassed}
                onChange={(v) => updateCheck('start', 'nonFePassed', v)} />
            </div>
          ) : (
            <CheckBtn label={t('insp.detectCheck')} value={startCheck.fePassed}
              onChange={(v) => updateCheck('start', 'fePassed', v)} />
          )}
          <div>
            <label className="label">{t('common.note')}</label>
            <input value={startCheck.note ?? ''} onChange={(e) => updateCheck('start', 'note', e.target.value)}
              className="input-field" placeholder={t('common.anomalyNote')} />
          </div>
        </div>

        {/* 終業テストピース確認 */}
        <div className="card p-4 space-y-3 border-l-4 border-slate-400">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600">🔴 {t('insp.endCheck')}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              endCheck.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {endCheck.passed ? t('insp.pass') : t('insp.fail')}
            </span>
          </div>
          <div>
            <label className="label">{t('insp.checkTime')}</label>
            <input type="time" value={endCheck.time}
              onChange={(e) => updateCheck('end', 'time', e.target.value)}
              className="input-field" />
          </div>
          {isMetal ? (
            <div className="space-y-2">
              <CheckBtn label="Fe" value={endCheck.fePassed}
                onChange={(v) => updateCheck('end', 'fePassed', v)} />
              <CheckBtn label="SUS" value={endCheck.susPassed}
                onChange={(v) => updateCheck('end', 'susPassed', v)} />
              <CheckBtn label="Non-Fe" value={endCheck.nonFePassed}
                onChange={(v) => updateCheck('end', 'nonFePassed', v)} />
            </div>
          ) : (
            <CheckBtn label={t('insp.detectCheck')} value={endCheck.fePassed}
              onChange={(v) => updateCheck('end', 'fePassed', v)} />
          )}
          <div>
            <label className="label">{t('common.note')}</label>
            <input value={endCheck.note ?? ''} onChange={(e) => updateCheck('end', 'note', e.target.value)}
              className="input-field" placeholder={t('common.anomalyNote')} />
          </div>
        </div>

        {/* 排除記録 */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">⚠️ {t('insp.rejectRecord')}</p>
          <div>
            <label className="label">{t('insp.rejectCount')}</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setRejectCount(Math.max(0, rejectCount - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-xl flex items-center justify-center hover:bg-gray-200">
                −
              </button>
              <span className="text-2xl font-extrabold text-gray-800 w-12 text-center">{rejectCount}</span>
              <button type="button" onClick={() => setRejectCount(rejectCount + 1)}
                className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 font-bold text-xl flex items-center justify-center hover:bg-teal-200">
                ＋
              </button>
              <span className="text-sm text-gray-500">{t('insp.unit')}</span>
            </div>
          </div>
          {rejectCount > 0 && (
            <div>
              <label className="label">{t('insp.rejectDetails')}</label>
              <AutoResizeTextarea value={rejectDetails} onChange={(e) => setRejectDetails(e.target.value)}
                className="input-field"
                placeholder="例: ロット〇〇の製品5個を隔離・廃棄" />
            </div>
          )}
        </div>

        {/* 総合判定 */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">📋 {t('insp.overallResult')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['pass', 'fail', 'adjusted'] as InspectionResult[]).map((r) => {
              const cfg = {
                pass: { color: 'bg-green-500 border-green-500 text-white shadow-green-200', idle: 'border-gray-200 text-gray-600 hover:border-green-400' },
                fail: { color: 'bg-red-500 border-red-500 text-white shadow-red-200', idle: 'border-gray-200 text-gray-600 hover:border-red-400' },
                adjusted: { color: 'bg-amber-500 border-amber-500 text-white shadow-amber-200', idle: 'border-gray-200 text-gray-600 hover:border-amber-400' },
              }[r]
              return (
                <button key={r} type="button" onClick={() => setResult(r)}
                  className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                    result === r ? `shadow-md ${cfg.color}` : `bg-white ${cfg.idle}`
                  }`}
                >
                  {INSPECTION_RESULT_LABELS[r]}
                </button>
              )
            })}
          </div>
          {(result === 'fail' || result === 'adjusted') && (
            <div>
              <label className="label">{t('record.corrective')}</label>
              <AutoResizeTextarea value={correctionAction} onChange={(e) => setCorrectionAction(e.target.value)}
                className="input-field"
                placeholder="例: 感度再調整・再テストピース確認後、製造再開" />
            </div>
          )}
          <div>
            <label className="label">{t('common.comment')}</label>
            <AutoResizeTextarea value={comment} onChange={(e) => setComment(e.target.value)}
              className="input-field" placeholder={t('common.specialNote')} />
          </div>
        </div>
        <div style={{ height: 'calc(168px + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-teal-100 p-4 shadow-[0_-4px_20px_rgba(20,184,166,0.08)]">
        <div className="max-w-2xl mx-auto">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-teal-200 transition-all active:scale-[0.98] disabled:opacity-50">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common.saving')}
              </span>
            ) : (
              t('insp.saveBtn')
            )}
          </button>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
