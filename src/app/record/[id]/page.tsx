'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { getIncident, updateIncident, deleteIncident, createReport } from '@/lib/firestore'
import {
  DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS, CLAIM_ROUTE_LABELS, OCCURRENCE_TYPE_LABELS,
  PDCA_STATUS_LABELS, PDCA_STATUS_COLORS,
  type IncidentStatus, type PdcaStatus, type RecallAssessment,
} from '@/lib/types'
import { generateIncidentCode, formatDate, formatDateTime } from '@/lib/utils'
import { generateIncidentReport, incidentToCSV } from '@/lib/report-generator'
import { generateIncidentDocx } from '@/lib/docx-generator'
import Navigation from '@/components/Navigation'
import ErrorBoundary from '@/components/ErrorBoundary'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'
import RecallAssessmentCard from '@/components/RecallAssessmentCard'
import PhotoImg from '@/components/PhotoImg'
import toast from 'react-hot-toast'
import type { Incident } from '@/lib/types'
import { FM_CATEGORIES, FM_CATEGORY_MAP, mapAiCategoryToFM, HIGH_URGENCY_NAMES } from '@/lib/foreign-matter-categories'

const URGENCY_CLASS = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }
const URGENCY_BAR = { high: 'bg-red-400', medium: 'bg-orange-400', low: 'bg-yellow-400' }

function parseVerification(text: string): { what: string; when: string; who: string; criteria: string } {
  const result = { what: '', when: '', who: '', criteria: '' }
  if (!text) return result
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (/^(?:確認内容|What)[：: ]/i.test(trimmed)) result.what = trimmed.replace(/^[^：:]+[：: ]\s*/, '').trim()
    else if (/^(?:時期|Timing)[：: ]/i.test(trimmed)) result.when = trimmed.replace(/^[^：:]+[：: ]\s*/, '').trim()
    else if (/^(?:担当者|Responsible)[：: ]/i.test(trimmed)) result.who = trimmed.replace(/^[^：:]+[：: ]\s*/, '').trim()
    else if (/^(?:判定基準|Acceptance)[：: ]/i.test(trimmed)) result.criteria = trimmed.replace(/^[^：:]+[：: ]\s*/, '').trim()
  }
  return result
}

function serializeVerification(what: string, when: string, who: string, criteria: string): string {
  return [
    what && `確認内容: ${what}`,
    when && `時期・頻度: ${when}`,
    who && `担当者: ${who}`,
    criteria && `判定基準: ${criteria}`,
  ].filter(Boolean).join('\n')
}


export default function IncidentDetailPage() {
  return (
    <ErrorBoundary>
      <IncidentDetailPageInner />
    </ErrorBoundary>
  )
}

function IncidentDetailPageInner() {
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
  // CAPA 直接編集
  const [editCorrective, setEditCorrective] = useState('')
  const [editPreventive, setEditPreventive] = useState('')
  // ④ 有効性の検証計画（4項目）
  const [verifyWhat, setVerifyWhat] = useState('')
  const [verifyWhen, setVerifyWhen] = useState('')
  const [verifyWho, setVerifyWho] = useState('')
  const [verifyCriteria, setVerifyCriteria] = useState('')
  const [verifyAiDrafted, setVerifyAiDrafted] = useState(false)
  const [actionsEditor, setActionsEditor] = useState('')
  const [savingActions, setSavingActions] = useState(false)
  const [actionsUpdatedAt, setActionsUpdatedAt] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftMemoryCount, setDraftMemoryCount] = useState(0)
  const [regenEnLoading, setRegenEnLoading] = useState(false)
  const [showRuleBased, setShowRuleBased] = useState(false)
  const [recallAssessment, setRecallAssessment] = useState<RecallAssessment>({
    q1_hazardous: null, q2_sharpHard: null, q3_healthClaim: null,
    q4_multipleInLot: null, q5_processOrigin: null, q6_inMarket: null,
  })
  const [savingRecall, setSavingRecall] = useState(false)

  // 正解の登録
  const [confirmedName, setConfirmedName] = useState('')
  const [confirmedCategory, setConfirmedCategory] = useState('')
  const [confirmedSubcategory, setConfirmedSubcategory] = useState('')
  const [confirmedMethod, setConfirmedMethod] = useState('')
  const [confirmedBy2, setConfirmedBy2] = useState('')
  const [confirmedNote, setConfirmedNote] = useState('')
  const [aiMatch, setAiMatch] = useState<'match' | 'partial' | 'mismatch' | ''>('')
  const [savingConfirmed, setSavingConfirmed] = useState(false)
  // PDCA AIアクション提案
  const [pdcaActionLoading, setPdcaActionLoading] = useState(false)

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
          // ④ 検証計画を4フィールドに分解
          const vText = data.editedVerification ?? ''
          const vParsed = parseVerification(vText)
          setVerifyWhat(vParsed.what)
          setVerifyWhen(vParsed.when)
          setVerifyWho(vParsed.who)
          setVerifyCriteria(vParsed.criteria)
          setActionsUpdatedAt(data.actionsUpdatedAt ?? data.causeVerifiedAt ?? '')
          // 正解の登録フィールドを復元（AIの第1候補の名前を初期値にする）
          setConfirmedName(data.confirmedName ?? data.estimations?.[0]?.name ?? data.estimations?.[0]?.category ?? '')
          const aiMapped = mapAiCategoryToFM(data.estimations?.[0]?.category ?? '')
          setConfirmedCategory(data.confirmedCategory ?? aiMapped.main)
          setConfirmedSubcategory(data.confirmedSubcategory ?? aiMapped.sub)
          setConfirmedMethod(data.confirmedMethod ?? '')
          setConfirmedBy2(data.confirmedBy ?? '')
          setConfirmedNote(data.confirmedNote ?? '')
          setAiMatch(data.aiMatch ?? '')
          // 回収要否の回答を復元
          if (data.recallAssessment) setRecallAssessment(data.recallAssessment)
          // Q1の初期値をAI判定から自動設定
          else if (!data.recallAssessment) {
            const topEst0 = data.estimations?.[0]
            const topCat = topEst0?.category ?? ''
            const topName = topEst0?.name ?? ''
            const isHighUrgency = topEst0?.urgency === 'high'
              || HIGH_URGENCY_NAMES.has(topCat)
              || HIGH_URGENCY_NAMES.has(topName)
            const isSafe = /植物|野菜|毛髪|毛|繊維|草|葉|種|木|皮|穀|米|藁/.test(topCat)
            if (isHighUrgency) setRecallAssessment(prev => ({ ...prev, q1_hazardous: 'yes' }))
            else if (isSafe) setRecallAssessment(prev => ({ ...prev, q1_hazardous: 'no' }))
          }
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
          discoveryDate: incident.discoveryDate,
          aiResult: topEst ? {
            name: topEst.name ?? topEst.category,
            category: topEst.category,
            urgency: topEst.urgency,
            route: topEst.route,
            action: topEst.action,
          } : null,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      const corrDraft = Array.isArray(data.corrective) ? data.corrective.join('\n') : (data.corrective ?? '')
      const prevDraft = Array.isArray(data.preventive) ? data.preventive.join('\n') : (data.preventive ?? '')
      // structured verification
      const verifObj: { what?: string; when?: string; who?: string; criteria?: string } | null =
        typeof data.verification === 'object' && data.verification !== null
          ? (data.verification as { what?: string; when?: string; who?: string; criteria?: string })
          : typeof data.verification === 'string'
            ? parseVerification(data.verification as string)
            : null
      if (mode === 'replace') {
        const hasExistingVerify = verifyWhat.trim() || verifyWhen.trim() || verifyWho.trim() || verifyCriteria.trim()
        if (hasExistingVerify && !window.confirm(isEn ? 'Overwrite the existing verification plan?' : '既存の④検証計画を上書きします。よろしいですか？')) {
          return
        }
        setEditCorrective(corrDraft)
        setEditPreventive(prevDraft)
        if (verifObj) {
          setVerifyWhat(verifObj.what ?? '')
          setVerifyWhen(verifObj.when ?? '')
          setVerifyWho(verifObj.who ?? '')
          setVerifyCriteria(verifObj.criteria ?? '')
        }
      } else {
        setEditCorrective(prev => prev ? `${prev}\n\n${corrDraft}` : corrDraft)
        setEditPreventive(prev => prev ? `${prev}\n\n${prevDraft}` : prevDraft)
        if (verifObj) {
          setVerifyWhat(prev => (prev && verifObj.what) ? `${prev}\n${verifObj.what}` : verifObj.what ?? prev)
          setVerifyWhen(prev => (prev && verifObj.when) ? `${prev}\n${verifObj.when}` : verifObj.when ?? prev)
          setVerifyWho(prev => (prev && verifObj.who) ? `${prev}\n${verifObj.who}` : verifObj.who ?? prev)
          setVerifyCriteria(prev => (prev && verifObj.criteria) ? `${prev}\n${verifObj.criteria}` : verifObj.criteria ?? prev)
        }
      }
      setVerifyAiDrafted(true)
      if (typeof data.memoryCasesUsed === 'number' && data.memoryCasesUsed > 0) {
        setDraftMemoryCount(data.memoryCasesUsed)
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
      const hintsYes = incident.hints
        ? Object.entries(incident.hints).filter(([, v]) => v === 'yes').map(([k]) => k).join(', ')
        : undefined
      const prevEst = incident.estimations?.[0]
      const prevContext = prevEst ? `前回の即時判定: ${prevEst.name ?? prevEst.category}（${prevEst.source === 'ai_vision' ? 'AI画像解析' : 'ルールベース'}）` : undefined
      const res = await fetch('/api/analyze-foreign-matter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: blob.type || 'image/jpeg',
          structured: true,
          productName: incident.productName || undefined,
          situationComment: incident.comment || undefined,
          hintsSummary: hintsYes || undefined,
          userHint: prevContext,
        }),
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
      const editedVerification = serializeVerification(verifyWhat, verifyWhen, verifyWho, verifyCriteria)
      await updateIncident(incident.id, {
        editedCorrective: editCorrective,
        editedPreventive: editPreventive,
        editedVerification,
        actionsUpdatedBy: actionsEditor,
        actionsUpdatedAt: now,
      })
      setActionsUpdatedAt(now)
      setIncident(prev => prev ? {
        ...prev,
        editedCorrective: editCorrective,
        editedPreventive: editPreventive,
        editedVerification,
        actionsUpdatedBy: actionsEditor,
        actionsUpdatedAt: now,
      } : prev)
      // AI関与がある場合は学習記憶に保存（非致命的）
      if (verifyAiDrafted || aiCorrectiveRaw || aiPreventiveRaw) {
        const topEst = incident.estimations?.[0]
        const humanFinalParts = [
          editCorrective && `①修正:${editCorrective.slice(0, 80)}`,
          editPreventive && `③是正:${editPreventive.slice(0, 80)}`,
          verifyWhat && `④確認:${verifyWhat.slice(0, 60)}`,
          verifyCriteria && `基準:${verifyCriteria.slice(0, 60)}`,
        ].filter(Boolean).join(' | ')
        fetch('/api/ai-memory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'capa_draft',
            category: topEst?.name ?? topEst?.category ?? incident.productName ?? '',
            input_summary: incident.comment ? `状況:${incident.comment.slice(0, 100)}` : '',
            ai_output: [aiCorrectiveRaw, aiPreventiveRaw].filter(Boolean).join(' | ').slice(0, 200),
            human_final: humanFinalParts,
          }),
        }).catch(() => {/* 非致命的 */})
      }
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
      const usedCount = typeof data.confirmedCasesUsed === 'number' ? data.confirmedCasesUsed : 0
      toast.success(
        usedCount > 0
          ? `${t('toast.aiCauseGenerated')} ${t('confirm.usedCases')}(${usedCount}件)`
          : t('toast.aiCauseGenerated')
      )
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
      const statusUpdate: Record<string, unknown> = { pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined }
      if (pdcaStatus === 'done') statusUpdate.status = 'closed'
      await updateIncident(incident.id, statusUpdate as Parameters<typeof updateIncident>[1])
      setIncident({ ...incident, pdcaStatus, pdcaDeadline: pdcaDeadline || undefined, pdcaNotes: pdcaNotes || undefined, ...(pdcaStatus === 'done' ? { status: 'closed' as const } : {}) })
      toast.success(t('toast.pdcaSaved'))
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSavingPdca(false)
    }
  }

  async function handleAiPdcaAction() {
    if (!incident) return
    setPdcaActionLoading(true)
    try {
      const res = await fetch('/api/ai-pdca-action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pdcaStatus,
          pdcaDeadline,
          productName: incident.productName,
          editedCorrective: editCorrective,
          editedCause: incident.editedCause ?? incident.aiCauseRaw ?? '',
          editedPreventive: editPreventive,
          verifyWhat,
          verifyWhen,
          verifyWho,
          verifyCriteria,
          lang: typeof window !== 'undefined' ? (localStorage.getItem('foodeye_lang') ?? 'ja') : 'ja',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      const suggestion = data.suggestion ?? ''
      setPdcaNotes(prev => prev
        ? `${prev}\n\n--- AIの提案 ---\n${suggestion}`
        : `--- AIの提案 ---\n${suggestion}`
      )
      toast.success(isEn ? 'AI suggestion generated ✅' : 'AIの提案を追記しました ✅')
    } catch {
      toast.error(isEn ? 'AI suggestion failed' : 'AI提案の生成に失敗しました')
    } finally {
      setPdcaActionLoading(false)
    }
  }

  async function handleSaveRecall() {
    if (!incident) return
    setSavingRecall(true)
    try {
      await updateIncident(incident.id, { recallAssessment })
      setIncident(prev => prev ? { ...prev, recallAssessment } : prev)
      toast.success(t('recall.saved'))
    } catch {
      toast.error(t('toast.saveFailed') || '保存に失敗しました')
    } finally {
      setSavingRecall(false)
    }
  }

  async function handleSaveConfirmed() {
    if (!incident) return
    if (!confirmedBy2.trim()) {
      toast.error(t('toast.confirmedNeedBy'))
      return
    }
    if (!confirmedName.trim()) {
      toast.error(isEn ? 'Please enter the confirmed foreign matter name' : '確定した異物名を入力してください')
      return
    }
    setSavingConfirmed(true)
    try {
      const now = new Date().toISOString()
      const updates = {
        confirmedName: confirmedName.trim(),
        confirmedCategory,
        confirmedSubcategory,
        confirmedMethod,
        confirmedBy: confirmedBy2.trim(),
        confirmedNote,
        aiMatch: (aiMatch || undefined) as 'match' | 'partial' | 'mismatch' | undefined,
        confirmedAt: now,
      }
      await updateIncident(incident.id, updates)
      // Supabase 確定事例テーブルにも保存
      try {
        await fetch('/api/incident-confirmations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            product_name: incident.productName ?? '',
            category: incident.estimations?.[0]?.category ?? '',
            confirmed_name: confirmedName.trim(),
            confirmed_category: confirmedCategory,
            confirmed_subcategory: confirmedSubcategory,
            hints: incident.hints
              ? Object.entries(incident.hints).filter(([, v]) => v === 'yes').map(([k]) => k).join(', ')
              : '',
            ai_match: aiMatch || '未評価',
          }),
        })
      } catch { /* Supabase失敗は非致命的 */ }
      // AI記憶にも保存（非致命的）
      const topEst2 = incident.estimations?.[0]
      fetch('/api/ai-memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'foreign_matter',
          category: confirmedCategory || topEst2?.category || '',
          input_summary: [
            incident.productName && `製品:${incident.productName}`,
            incident.comment ? `状況:${incident.comment.slice(0, 100)}` : null,
            topEst2?.name ? `AI判定:${topEst2.name}` : null,
          ].filter(Boolean).join(' '),
          ai_output: topEst2?.name ?? topEst2?.category ?? '',
          human_final: `${confirmedName.trim()}（${confirmedCategory}${confirmedSubcategory ? '/' + confirmedSubcategory : ''}）${confirmedMethod ? ' 確認方法:' + confirmedMethod : ''}`,
        }),
      }).catch(() => {/* 非致命的 */})
      setIncident(prev => prev ? { ...prev, ...updates } : prev)
      toast.success(t('toast.confirmedSaved'))
    } catch {
      toast.error(t('toast.confirmedFailed'))
    } finally {
      setSavingConfirmed(false)
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
        {incident.estimations && incident.estimations.length > 0 && (() => {
          const aiVisionEst = incident.estimations[0]?.source === 'ai_vision' ? incident.estimations[0] : null
          const topIsHighConfidenceAi = !!aiVisionEst && aiVisionEst.urgency === 'high'
          const aiIsNonMetal = !!aiVisionEst && !/金属|ステンレス|SUS|鉄|アルミ|銅|ガラス|glass|metal/i.test(aiVisionEst.category)
          const isMetalCandidate = (cat: string) => /金属|ステンレス|SUS|鉄|アルミ|銅|鋼/.test(cat)
          const mainEsts = topIsHighConfidenceAi
            ? incident.estimations.filter(e => e.source === 'ai_vision')
            : aiIsNonMetal
              ? incident.estimations.filter(e => e.source === 'ai_vision' || !isMetalCandidate(e.category))
              : incident.estimations
          const ruleEsts = topIsHighConfidenceAi
            ? incident.estimations.filter(e => e.source !== 'ai_vision')
            : aiIsNonMetal
              ? incident.estimations.filter(e => e.source !== 'ai_vision' && isMetalCandidate(e.category))
              : []
          return (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="section-title mb-0">{t('detail.aiEstTitle')}</p>
              {incident.confirmedName && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 shrink-0">
                  ✅ {t('detail.confirmedRegistered')}{incident.confirmedName}
                </span>
              )}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
              <p className="text-yellow-700 text-xs font-medium">
                {t('detail.aiEstDisclaimer')}
              </p>
            </div>
            <div className="space-y-4">
              {mainEsts.map((est, i) => {
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
            {/* ルールベース候補（AI高信頼度時は折りたたみ） */}
            {ruleEsts.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRuleBased(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span>{showRuleBased ? '▾' : '▸'}</span>
                  <span>{isEn ? `Reference: feature-based estimates (${ruleEsts.length})` : `参考: 特徴チェックからの推定 (${ruleEsts.length}件)`}</span>
                </button>
                {showRuleBased && (
                  <div className="mt-2 space-y-3 opacity-70">
                    {ruleEsts.map((est, j) => {
                      const displayName = isEn ? (est.nameEn ?? est.name ?? est.category) : (est.name ?? est.category)
                      return (
                        <div key={j} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 font-semibold">{displayName}</span>
                            <span className="text-xs text-gray-400 font-bold">{est.probability}%</span>
                          </div>
                          {est.basis.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {est.basis.map((b, k) => (
                                <span key={k} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })()}

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
                      <PhotoImg src={src} alt="" className="w-full h-full object-cover" />
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
                      <PhotoImg src={src} alt="" className="w-full h-full object-cover" />
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

        {/* 回収要否の判断材料 */}
        <RecallAssessmentCard
          value={recallAssessment}
          onChange={setRecallAssessment}
          onSave={handleSaveRecall}
          saving={savingRecall}
        />

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
          {draftMemoryCount > 0 && (
            <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
              📚 {isEn ? `Referenced ${draftMemoryCount} past cases` : `${draftMemoryCount}件の学習済み事例を参考にしました`}
            </div>
          )}

          <div className="space-y-3">
            {/* ② 原因 */}
            {(incident.editedCause || incident.aiCauseRaw) ? (
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  {isEn ? '② Root Cause (4M: Man / Machine / Material / Method)' : '② 原因（4M：人・機械・材料・方法）'}
                </label>
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {incident.editedCause ?? incident.aiCauseRaw}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCausePanel(true)}
                  className="text-[10px] text-purple-500 hover:text-purple-700 mt-1"
                >
                  {isEn ? '✏️ Edit in AI Root Cause Analysis ↓' : '✏️ 下の原因分析カードで編集 ↓'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateCause}
                disabled={causeLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {causeLoading
                  ? <><span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />{isEn ? 'Analyzing...' : '分析中...'}</>
                  : <>🧠 {isEn ? 'AI Root Cause Analysis (② Cause)' : 'AIで原因を作成（② 原因）'}</>}
              </button>
            )}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.correctiveLabel')}</label>
              <AutoResizeTextarea
                value={editCorrective}
                onChange={e => setEditCorrective(e.target.value)}
                className="input-field text-sm"
                placeholder={isEn ? 'e.g. Quarantine lot, hold shipment, preserve physical evidence...' : '例: 当該ロットを隔離・出荷保留、現物を保管し品質管理部に報告...'}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.preventiveLabel')}</label>
              <p className="text-[10px] text-gray-400 mb-1">{isEn ? 'Include: responsible person, target date per item' : '各項目に「担当者・期限」を記入'}</p>
              <AutoResizeTextarea
                value={editPreventive}
                onChange={e => setEditPreventive(e.target.value)}
                className="input-field text-sm"
                placeholder={isEn ? 'e.g. Revise SOP (Responsible: QA, Target: 2026/11/01)...' : '例: 洗浄手順の見直し（担当: 品質管理部 期限: 2026/11/01）...'}
              />
            </div>
            {/* ④ 有効性の検証計画（4項目） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-600">{t('detail.verificationLabel')}</label>
                <button
                  type="button"
                  onClick={() => handleAiDraftDetail('replace')}
                  disabled={draftLoading}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                >
                  {draftLoading
                    ? <span className="w-2.5 h-2.5 border border-green-500 border-t-transparent rounded-full animate-spin" />
                    : '🤖'}
                  {isEn ? 'AI Draft' : 'AIで下書き'}
                </button>
              </div>
              {verifyAiDrafted && (verifyWhat || verifyWhen || verifyWho || verifyCriteria) && (
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                  🤖 {isEn ? 'AI Draft (requires review)' : 'AI下書き（要確認）'}
                </div>
              )}
              <div className="space-y-2 bg-green-50 border border-green-100 rounded-xl p-3">
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">{isEn ? '🔍 What to confirm' : '🔍 確認内容（何を確認するか）'}</p>
                  <AutoResizeTextarea
                    value={verifyWhat}
                    onChange={e => setVerifyWhat(e.target.value)}
                    className="input-field text-sm bg-white"
                    placeholder={isEn ? 'e.g. No recurrence of same foreign matter type' : '例: 同種異物の再発がないこと'}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">{isEn ? '📅 Timing / Frequency' : '📅 時期・頻度'}</p>
                  <input
                    value={verifyWhen}
                    onChange={e => setVerifyWhen(e.target.value)}
                    className="input-field text-sm bg-white"
                    placeholder={isEn ? 'e.g. Weekly for 1 month after implementation' : '例: 実施後1か月間、毎週'}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">{isEn ? '👤 Responsible person' : '👤 担当者'}</p>
                  <input
                    value={verifyWho}
                    onChange={e => setVerifyWho(e.target.value)}
                    className="input-field text-sm bg-white"
                    placeholder={isEn ? 'e.g. QA Department' : '例: 品質管理部'}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">{isEn ? '✅ Acceptance criteria' : '✅ 判定基準'}</p>
                  <AutoResizeTextarea
                    value={verifyCriteria}
                    onChange={e => setVerifyCriteria(e.target.value)}
                    className="input-field text-sm bg-white"
                    placeholder={isEn ? 'e.g. 0 incidents of same type for 3 months' : '例: 同種異物の発生0件、点検記録の記入漏れ0件'}
                  />
                </div>
              </div>
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
              <button
                type="button"
                onClick={handleAiPdcaAction}
                disabled={pdcaActionLoading}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {pdcaActionLoading
                  ? <><span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{isEn ? 'Generating...' : '生成中...'}</>
                  : <>🤖 {isEn ? 'AI: Suggest Next Actions' : '次のアクションをAIで提案'}</>}
              </button>
              <p className="text-[10px] text-gray-400 mt-1">
                {isEn ? 'AI suggestion only. Edit to match your actual situation before saving.' : 'AIの提案です。現場の状況に合わせて編集してください。'}
              </p>
            </div>
          </div>
          <button onClick={handleSavePdca} disabled={savingPdca}
            className="w-full py-3 bg-indigo-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-600 transition-all">
            {savingPdca ? t('common.saving') : t('detail.savePdca')}
          </button>
        </div>

        {/* ✅ 正解の登録 */}
        <div className="card p-4 no-print" id="confirmed-card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('detail.confirmedCard')}</p>
            {incident.confirmedAt && (
              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-semibold">
                ✅ {incident.confirmedBy} {new Date(incident.confirmedAt).toLocaleDateString('ja-JP')}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.confirmedName')} <span className="text-red-400">*</span></label>
              <input
                value={confirmedName}
                onChange={e => setConfirmedName(e.target.value)}
                className="input-field"
                placeholder={isEn ? 'e.g. Cooking sheet fragment, bone chip...' : '例: クッキングシートの切れ端、鶏骨片...'}
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* 大分類 */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{isEn ? 'Category (main)' : '大分類'}</label>
              <select
                value={confirmedCategory}
                onChange={e => { setConfirmedCategory(e.target.value); setConfirmedSubcategory('') }}
                className="input-field text-sm"
                style={{ fontSize: '16px' }}
              >
                <option value="">{isEn ? '(select)' : '(選択)'}</option>
                {FM_CATEGORIES.map(c => (
                  <option key={c.name} value={c.name}>{isEn ? c.nameEn : c.name}</option>
                ))}
              </select>
            </div>
            {/* 小分類（大分類が選ばれていて subcategoryがある場合のみ表示） */}
            {confirmedCategory && (FM_CATEGORY_MAP.get(confirmedCategory)?.subs.length ?? 0) > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">{isEn ? 'Category (sub)' : '小分類'}</label>
                <select
                  value={confirmedSubcategory}
                  onChange={e => setConfirmedSubcategory(e.target.value)}
                  className="input-field text-sm"
                  style={{ fontSize: '16px' }}
                >
                  <option value="">{isEn ? '(not specified)' : '（未選択）'}</option>
                  {FM_CATEGORY_MAP.get(confirmedCategory)!.subs.map(s => (
                    <option key={s.name} value={s.name}>{isEn ? s.nameEn : s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* 確認方法 */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.confirmedMethod')}</label>
              <select
                value={confirmedMethod}
                onChange={e => setConfirmedMethod(e.target.value)}
                className="input-field text-sm"
                style={{ fontSize: '16px' }}
              >
                <option value="">{isEn ? '(select)' : '(選択)'}</option>
                {(isEn
                  ? ['Visual', 'Physical match', 'FT-IR/analysis', 'External lab', 'Other']
                  : ['目視', '現物照合', 'FT-IR等の分析', '外部機関', 'その他']
                ).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.aiMatchLabel')}</label>
              <div className="flex gap-2">
                {(['match', 'partial', 'mismatch'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAiMatch(prev => prev === v ? '' : v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      aiMatch === v
                        ? v === 'match' ? 'bg-green-500 text-white border-green-500'
                          : v === 'partial' ? 'bg-yellow-400 text-white border-yellow-400'
                          : 'bg-red-400 text-white border-red-400'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {t(`confirm.aiMatch.${v}` as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.confirmedBy')} <span className="text-red-400">*</span></label>
              <input
                value={confirmedBy2}
                onChange={e => setConfirmedBy2(e.target.value)}
                className="input-field"
                placeholder={isEn ? 'e.g. QA Dept. – Suzuki' : '例: 品質管理部 鈴木'}
                style={{ fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">{t('detail.confirmedNote')}</label>
              <AutoResizeTextarea
                value={confirmedNote}
                onChange={e => setConfirmedNote(e.target.value)}
                className="input-field text-sm"
                placeholder={isEn ? 'Additional notes...' : '備考・補足情報...'}
              />
            </div>
          </div>

          <button
            onClick={handleSaveConfirmed}
            disabled={savingConfirmed || !confirmedBy2.trim() || !confirmedName.trim()}
            className="w-full mt-3 py-3 bg-green-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-green-200 disabled:opacity-50 hover:bg-green-600 transition-all active:scale-[0.98]"
          >
            {savingConfirmed ? t('common.saving') : t('detail.saveConfirmed')}
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
