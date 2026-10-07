'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createSensoryEvaluation, findIncidentsByLot } from '@/lib/firestore'
import {
  SENSORY_JUDGEMENT_LABELS,
  JUDGEMENT_METHOD_OPTIONS,
  APPEARANCE_GRADE_LABELS,
} from '@/lib/types'
import type {
  AppearanceEval, SmellEval, TasteEval, TextureEval,
  SensoryJudgement, AppearanceGrade,
  TasteScore, ScentEval, TextureScore, SoundEval,
} from '@/lib/types'
import Navigation from '@/components/Navigation'
import DateInput from '@/components/DateInput'
import toast from 'react-hot-toast'

const STEPS = ['製品情報', '五感評価', '判定']

// ── 共通UIパーツ ─────────────────────────────────────────────────

/** 1〜5 スコアボタン */
function ScoreRow({
  label,
  value,
  onChange,
  leftLabel = '弱い',
  rightLabel = '強い',
  color = 'blue',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  leftLabel?: string
  rightLabel?: string
  color?: 'blue' | 'orange' | 'green'
}) {
  const activeColors: Record<string, string> = {
    blue: 'bg-blue-500 border-blue-500 text-white shadow-blue-200',
    orange: 'bg-orange-500 border-orange-500 text-white shadow-orange-200',
    green: 'bg-green-500 border-green-500 text-white shadow-green-200',
  }
  const hoverColors: Record<string, string> = {
    blue: 'hover:border-blue-400 hover:bg-blue-50',
    orange: 'hover:border-orange-400 hover:bg-orange-50',
    green: 'hover:border-green-400 hover:bg-green-50',
  }
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {value > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value >= 4 ? 'bg-red-100 text-red-600' : value >= 3 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-700'}`}>
            {value} / 5
          </span>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <span className="text-[10px] text-gray-400 shrink-0">{leftLabel}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-extrabold transition-all active:scale-95 ${
              value === n
                ? `${activeColors[color]} shadow-md`
                : `bg-white border-gray-200 text-gray-500 ${hoverColors[color]}`
            }`}
          >
            {n}
          </button>
        ))}
        <span className="text-[10px] text-gray-400 shrink-0">{rightLabel}</span>
      </div>
    </div>
  )
}

/** セクションヘッダー */
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-sm font-extrabold text-gray-800">{title}</p>
        {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────

export default function SensoryNewPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [linkedCount, setLinkedCount] = useState<number | null>(null)

  // Step 1
  const [productName, setProductName] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [inspectorName, setInspectorName] = useState('')

  // Step 2 – 詳細評価
  const [tasteScore, setTasteScore] = useState<TasteScore>({
    sweet: 3, sour: 3, salty: 3, bitter: 1, umami: 3,
  })
  const [scentEval, setScentEval] = useState<ScentEval>({ status: 'normal', intensity: 1 })
  const [appearanceGrade, setAppearanceGrade] = useState<AppearanceGrade>('good')
  const [textureScore, setTextureScore] = useState<TextureScore>({
    hardness: 3, stickiness: 2, mouthfeel: 3, chewiness: 3,
  })
  const [soundEval, setSoundEval] = useState<SoundEval>({ crunchy: false, comment: '' })
  const [limitSamplePhoto, setLimitSamplePhoto] = useState<string>('')
  const [comment, setComment] = useState('')

  // Step 3
  const [judgement, setJudgement] = useState<SensoryJudgement>('pass')
  const [judgementMethod, setJudgementMethod] = useState<string[]>([])
  const [approverName, setApproverName] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user?.displayName) setInspectorName(user.displayName)
    else if (user?.email) setInspectorName(user.email.split('@')[0])
  }, [user])

  async function checkLinkedIncidents() {
    if (!lotNumber || !user) return
    const incidents = await findIncidentsByLot(lotNumber, user.uid)
    setLinkedCount(incidents.length)
  }

  // 詳細スコアからサマリー型を自動導出
  function deriveSummaryFields() {
    // 味覚サマリー
    let taste: TasteEval = 'normal'
    if (tasteScore.bitter >= 4) taste = 'bitter'
    else if (tasteScore.salty >= 4) taste = 'salty'
    else if (tasteScore.sour >= 4 || tasteScore.bitter >= 3) taste = 'off_flavor'

    // 香りサマリー
    const smell: SmellEval = scentEval.status

    // 外観サマリー
    let appearance: AppearanceEval = 'normal'
    if (appearanceGrade === 'defective') appearance = 'foreign_material'
    else if (appearanceGrade === 'limit') appearance = 'discolored'

    // 触感サマリー
    let texture: TextureEval = 'normal'
    if (textureScore.hardness >= 5) texture = 'hard'
    else if (textureScore.stickiness >= 4) texture = 'sticky'

    return { taste, smell, appearance, texture }
  }

  // AI自動判定
  function autoJudge() {
    const { taste, smell, appearance } = deriveSummaryFields()

    const hasMajorIssue =
      appearanceGrade === 'defective' ||
      (scentEval.status === 'abnormal' && scentEval.intensity >= 4) ||
      tasteScore.bitter >= 5 ||
      appearance === 'foreign_material'

    const hasIssue =
      appearanceGrade === 'limit' ||
      scentEval.status === 'abnormal' ||
      taste !== 'normal' ||
      smell !== 'normal' ||
      textureScore.hardness >= 5 ||
      textureScore.stickiness >= 4

    if (hasMajorIssue || hasIssue) {
      setJudgement('fail')
      toast(hasMajorIssue ? 'AI自動判定: 出荷停止の可能性があります' : 'AI自動判定: 要確認 — 出荷停止を推奨', { icon: '❌' })
    } else {
      setJudgement('pass')
      toast('AI自動判定: 合格の可能性があります', { icon: '✅' })
    }
  }

  function toggleMethod(m: string) {
    setJudgementMethod((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    )
  }

  async function handleSubmit() {
    if (!user) return
    setSubmitting(true)
    try {
      const { taste, smell, appearance, texture } = deriveSummaryFields()
      const incidents = await findIncidentsByLot(lotNumber, user.uid)
      const id = await createSensoryEvaluation({
        productName, lotNumber,
        date: new Date(date).toISOString(),
        inspectorName, approverName,
        appearance, smell, taste, texture,
        tasteScore, scentEval, appearanceGrade, textureScore, soundEval,
        limitSamplePhoto: limitSamplePhoto || undefined,
        comment, judgement, judgementMethod,
        images: [],
        linkedIncidentIds: incidents.map((i) => i.id),
        approvedAt: null, approvedBy: null,
        createdBy: user.uid,
      })
      toast.success('官能検査を登録しました ✅')
      router.push(`/sensory/${id}`)
    } catch {
      toast.error('登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const canNext = [
    productName.trim() !== '' && inspectorName.trim() !== '',
    true,
    judgementMethod.length > 0,
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-blue-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => (step > 0 ? setStep(step - 1) : router.push('/sensory'))} className="back-btn shrink-0">←</button>
          <div className="flex-1">
            <h1 className="font-extrabold text-gray-800 text-base">新規官能検査</h1>
            <p className="text-xs text-gray-500">ステップ {step + 1} / {STEPS.length}：{STEPS[step]}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
              <p className={`text-[10px] font-semibold text-center ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>{s}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">

        {/* ━━ Step 1: 製品情報 ━━ */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl p-4 text-white">
              <p className="font-extrabold text-lg">🔬 ステップ 1 — 製品情報</p>
              <p className="text-sm text-white/80 mt-0.5">製品の基本情報を入力してください</p>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <label className="label">製品名 <span className="text-red-400">*</span></label>
                <input value={productName} onChange={(e) => setProductName(e.target.value)}
                  className="input-field" placeholder="例：○○弁当 鮭おにぎり" />
              </div>
              <div>
                <label className="label">ロット番号</label>
                <div className="flex gap-2">
                  <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                    className="input-field flex-1" placeholder="例：LOT-2026-0516-A1" />
                  <button type="button" onClick={checkLinkedIncidents} disabled={!lotNumber}
                    className="shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold bg-orange-100 text-orange-600 hover:bg-orange-200 disabled:opacity-40 transition-all">
                    🔗 照合
                  </button>
                </div>
                {linkedCount !== null && (
                  <p className={`text-xs mt-1.5 font-medium ${linkedCount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {linkedCount > 0 ? `⚠️ 関連する異物事故が ${linkedCount} 件あります` : '✅ 関連異物事故なし'}
                  </p>
                )}
              </div>
              <div>
                <label className="label">検査日時 <span className="text-red-400">*</span></label>
                <DateInput value={date} onChange={setDate} type="datetime-local" />
              </div>
              <div>
                <label className="label">検査担当者名 <span className="text-red-400">*</span></label>
                <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)}
                  className="input-field" placeholder="例：田中 花子" />
              </div>
            </div>
          </div>
        )}

        {/* ━━ Step 2: 五感評価 ━━ */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl p-4 text-white">
              <p className="font-extrabold text-lg">👅 ステップ 2 — 五感評価</p>
              <p className="text-sm text-white/80 mt-0.5">各項目を5段階で評価してください</p>
            </div>

            {/* ① 味覚 */}
            <div className="card p-5">
              <SectionHeader icon="👅" title="味覚" subtitle="各成分の強弱を1〜5で評価（1=とても弱い　5=とても強い）" />
              <ScoreRow label="甘味" value={tasteScore.sweet} onChange={(v) => setTasteScore({ ...tasteScore, sweet: v })} leftLabel="弱い" rightLabel="強い" />
              <ScoreRow label="酸味" value={tasteScore.sour}  onChange={(v) => setTasteScore({ ...tasteScore, sour: v })}  leftLabel="弱い" rightLabel="強い" />
              <ScoreRow label="塩味" value={tasteScore.salty} onChange={(v) => setTasteScore({ ...tasteScore, salty: v })} leftLabel="弱い" rightLabel="強い" />
              <ScoreRow label="苦味" value={tasteScore.bitter} onChange={(v) => setTasteScore({ ...tasteScore, bitter: v })} leftLabel="なし" rightLabel="強い" color="orange" />
              <ScoreRow label="うま味" value={tasteScore.umami} onChange={(v) => setTasteScore({ ...tasteScore, umami: v })} leftLabel="弱い" rightLabel="強い" color="green" />
            </div>

            {/* ② 香り */}
            <div className="card p-5">
              <SectionHeader icon="👃" title="香り（嗅覚）" subtitle="食品特有の香り・風味・異臭を評価" />
              <div className="flex gap-2 mb-4">
                {(['normal', 'abnormal'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setScentEval({ ...scentEval, status: s })}
                    className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95 ${
                      scentEval.status === s
                        ? s === 'normal' ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200'
                          : 'bg-red-500 border-red-500 text-white shadow-md shadow-red-200'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-blue-50'
                    }`}>
                    {s === 'normal' ? '✅ 正常' : '⚠️ 異臭あり'}
                  </button>
                ))}
              </div>
              {scentEval.status === 'abnormal' && (
                <ScoreRow
                  label="異臭の強さ"
                  value={scentEval.intensity}
                  onChange={(v) => setScentEval({ ...scentEval, intensity: v })}
                  leftLabel="微弱"
                  rightLabel="強烈"
                  color="orange"
                />
              )}
            </div>

            {/* ③ 色・外観 */}
            <div className="card p-5">
              <SectionHeader icon="👁️" title="色・外観（視覚）" subtitle="全体の色調・形状・艶などを総合評価" />
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(Object.entries(APPEARANCE_GRADE_LABELS) as [AppearanceGrade, string][]).map(([k, v]) => {
                  const styles: Record<AppearanceGrade, { active: string; inactive: string; icon: string }> = {
                    good:     { active: 'bg-green-500 border-green-500 text-white shadow-green-200', inactive: 'border-green-200 text-green-700 hover:bg-green-50', icon: '✅' },
                    limit:    { active: 'bg-amber-500 border-amber-500 text-white shadow-amber-200', inactive: 'border-amber-200 text-amber-700 hover:bg-amber-50',   icon: '⚠️' },
                    defective:{ active: 'bg-red-500   border-red-500   text-white shadow-red-200',   inactive: 'border-red-200   text-red-700   hover:bg-red-50',     icon: '❌' },
                  }
                  const s = styles[k]
                  return (
                    <button key={k} type="button" onClick={() => setAppearanceGrade(k)}
                      className={`py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95 ${
                        appearanceGrade === k ? `shadow-md ${s.active}` : `bg-white ${s.inactive}`
                      }`}>
                      <div className="text-xl mb-0.5">{s.icon}</div>
                      {v}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                良品：規格内　限度見本：ギリギリ許容範囲　出荷一時停止：明らかな規格外
              </p>

              {/* 限度見本 — 比較写真アップロード */}
              {appearanceGrade === 'limit' && (
                <div className="mt-2 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">📸 限度見本写真を添付（比較用）</p>
                  <p className="text-[10px] text-amber-600 mb-3 leading-relaxed">
                    社内の限度見本サンプル写真を撮影・挿入して、今回の製品と比較できます
                  </p>
                  {limitSamplePhoto ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <img src={limitSamplePhoto} alt="限度見本" className="w-full rounded-xl object-cover max-h-48 border border-amber-200" />
                        <button
                          type="button"
                          onClick={() => setLimitSamplePhoto('')}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md"
                        >
                          ✕
                        </button>
                        <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          限度見本
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-600 text-center font-medium">
                        ↑ 限度見本写真　／　↓ 今回の製品と比較してください
                      </p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer py-4">
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-bold text-amber-600">限度見本写真を追加</span>
                      <span className="text-[10px] text-gray-400">カメラ撮影 または ギャラリーから選択</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            if (ev.target?.result) setLimitSamplePhoto(ev.target.result as string)
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* ④ 触感 */}
            <div className="card p-5">
              <SectionHeader icon="✋" title="触感・食感（触覚）" subtitle="口に含んだときの感触を評価" />
              <ScoreRow label="硬さ" value={textureScore.hardness}   onChange={(v) => setTextureScore({ ...textureScore, hardness: v })}   leftLabel="柔らかい" rightLabel="硬い" />
              <ScoreRow label="粘り" value={textureScore.stickiness} onChange={(v) => setTextureScore({ ...textureScore, stickiness: v })} leftLabel="サラサラ" rightLabel="粘つく" color="orange" />
              <ScoreRow label="口どけ" value={textureScore.mouthfeel} onChange={(v) => setTextureScore({ ...textureScore, mouthfeel: v })} leftLabel="溶けにくい" rightLabel="なめらか" color="green" />
              <ScoreRow label="歯ごたえ" value={textureScore.chewiness} onChange={(v) => setTextureScore({ ...textureScore, chewiness: v })} leftLabel="ない" rightLabel="強い" />
            </div>

            {/* ⑤ 音 */}
            <div className="card p-5">
              <SectionHeader icon="👂" title="音（聴覚）" subtitle="噛んだときの音を評価" />
              <div className="flex gap-3 mb-3">
                <button type="button" onClick={() => setSoundEval({ ...soundEval, crunchy: true })}
                  className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95 ${
                    soundEval.crunchy ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'
                  }`}>
                  🔊 パリッと音あり
                </button>
                <button type="button" onClick={() => setSoundEval({ ...soundEval, crunchy: false })}
                  className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95 ${
                    !soundEval.crunchy ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'
                  }`}>
                  🔇 音なし
                </button>
              </div>
              <input value={soundEval.comment} onChange={(e) => setSoundEval({ ...soundEval, comment: e.target.value })}
                className="input-field text-sm" placeholder="音に関するコメント（任意）" />
            </div>

            {/* コメント */}
            <div className="card p-5">
              <p className="text-xs font-bold text-gray-500 mb-2">📝 総合コメント・特記事項</p>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                rows={3} className="input-field resize-none"
                placeholder="気になった点、基準との差異、追加観察事項などを記入..." />
            </div>

            {/* AI 自動判定 */}
            <button type="button" onClick={autoJudge}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98]">
              🤖 評価スコアからAI自動判定を実行する
            </button>
          </div>
        )}

        {/* ━━ Step 3: 判定 ━━ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl p-4 text-white">
              <p className="font-extrabold text-lg">✅ ステップ 3 — 総合判定</p>
              <p className="text-sm text-white/80 mt-0.5">最終判定と承認者を入力してください</p>
            </div>

            <div className="card p-5">
              {/* 判定 */}
              <p className="text-xs font-bold text-gray-500 mb-3">📊 総合判定 <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(['pass', 'fail'] as SensoryJudgement[]).map((k) => {
                  const v = SENSORY_JUDGEMENT_LABELS[k]
                  const icons: Record<string, string> = { pass: '✅', fail: '❌' }
                  const colors: Record<string, string> = {
                    pass: judgement === k ? 'bg-green-500 border-green-500 text-white shadow-green-200' : 'border-green-300 text-green-700 hover:bg-green-50',
                    fail: judgement === k ? 'bg-red-500   border-red-500   text-white shadow-red-200'   : 'border-red-300   text-red-700   hover:bg-red-50',
                  }
                  return (
                    <button key={k} type="button" onClick={() => setJudgement(k)}
                      className={`py-4 rounded-2xl border-2 font-bold text-sm transition-all active:scale-95 ${judgement === k ? `shadow-md ${colors[k]}` : `bg-white ${colors[k]}`}`}>
                      <div className="text-2xl mb-1">{icons[k]}</div>
                      {v}
                    </button>
                  )
                })}
              </div>

              {/* 判定方法 */}
              <p className="text-xs font-bold text-gray-500 mb-2">📋 判定方法（複数選択可）<span className="text-red-400"> *</span></p>
              <div className="flex flex-wrap gap-2 mb-5">
                {JUDGEMENT_METHOD_OPTIONS.map((m) => (
                  <button key={m} type="button" onClick={() => toggleMethod(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      judgementMethod.includes(m)
                        ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                        : 'bg-white border-blue-200 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>

              {/* 承認者 */}
              <div>
                <label className="label">最終承認者名</label>
                <input value={approverName} onChange={(e) => setApproverName(e.target.value)}
                  className="input-field" placeholder="例：鈴木 課長（品質管理）" />
                <p className="text-xs text-gray-400 mt-1">承認は詳細画面の「承認する」ボタンで後から行えます</p>
              </div>
            </div>

            {/* スコアサマリー */}
            <div className={`rounded-2xl border p-4 ${
              judgement === 'pass' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs font-bold text-gray-600 mb-2">評価サマリー</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-700">
                <p>製品：{productName}</p>
                <p>ロット：{lotNumber || '未入力'}</p>
                <p>外観：{APPEARANCE_GRADE_LABELS[appearanceGrade]}</p>
                <p>香り：{scentEval.status === 'normal' ? '正常' : `異臭（強度${scentEval.intensity}）`}</p>
                <p>苦味：{tasteScore.bitter}/5　塩味：{tasteScore.salty}/5</p>
                <p>硬さ：{textureScore.hardness}/5　粘り：{textureScore.stickiness}/5</p>
                <p>パリッと音：{soundEval.crunchy ? 'あり' : 'なし'}</p>
                <p>うま味：{tasteScore.umami}/5</p>
              </div>
            </div>
          </div>
        )}
        <div style={{ height: 'calc(168px + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />
      </div>

      {/* 固定フッターボタン */}
      <div className="fixed bottom-20 left-0 right-0 px-5 pb-2 z-40 no-print">
        <div className="max-w-2xl mx-auto">
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext[step]}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-extrabold text-base shadow-xl shadow-blue-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              次へ → {STEPS[step + 1]}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting || judgementMethod.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-extrabold text-base shadow-xl shadow-green-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  登録中...
                </span>
              ) : '✅ 官能検査を登録する'}
            </button>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  )
}
