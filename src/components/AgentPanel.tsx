'use client'

import { useState, useEffect } from 'react'
import type { AgentStep, PartialResult, AgentSessionData } from '@/lib/agent/types'

interface AnalysisInput {
  urgency: 'high' | 'medium' | 'low'
  candidates: { name: string; probability: number; reason?: string }[]
  visualFeatures: string[]
}

interface AgentPanelProps {
  analysis: AnalysisInput
  lang: string
  userHint?: string
  onClose: () => void
}

const TOOL_LABELS: Record<string, { ja: string; en: string; icon: string }> = {
  get_knowledge:            { ja: '異物知識を確認',     en: 'Checking knowledge base',  icon: '📚' },
  search_similar_incidents: { ja: '類似事例を検索',     en: 'Searching past incidents', icon: '🔍' },
  create_action_checklist:  { ja: 'チェックリストを生成', en: 'Creating action checklist', icon: '📋' },
  submit_for_approval:      { ja: '承認を申請',         en: 'Requesting approval',      icon: '🔐' },
  draft_capa_report:        { ja: 'CAPA報告書を作成',   en: 'Drafting CAPA report',     icon: '📝' },
  save_incident:            { ja: '異物事故を記録',     en: 'Saving incident record',   icon: '💾' },
}

type PanelStatus = 'running' | 'awaiting_approval' | 'completed' | 'rejected' | 'error'

export default function AgentPanel({ analysis, lang, userHint, onClose }: AgentPanelProps) {
  const isEn = lang === 'en'

  const [status, setStatus] = useState<PanelStatus>('running')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [result, setResult] = useState<PartialResult | null>(null)
  const [sessionData, setSessionData] = useState<AgentSessionData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [approverName, setApproverName] = useState('')
  const [approverComment, setApproverComment] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [capaText, setCapaText] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void runAgent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAgent() {
    setStatus('running')
    setSteps([])
    setResult(null)
    setErrorMsg('')
    try {
      const body = {
        analysisResult: {
          urgency: analysis.urgency,
          // Page stores probability as 0-100; agent loop expects 0-1
          candidates: analysis.candidates.map(c => ({
            name: c.name,
            probability: c.probability / 100,
            reason: c.reason,
          })),
          visualFeatures: analysis.visualFeatures,
        },
        lang,
        userHint: userHint?.slice(0, 500),
      }
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? (isEn ? 'Agent error' : 'エージェントエラー'))
        setStatus('error')
        return
      }
      setSteps(data.steps ?? [])
      setResult(data.result ?? null)
      if (data.status === 'awaiting_approval') {
        setSessionData(data.sessionData ?? null)
        setStatus('awaiting_approval')
      } else {
        setStatus('completed')
        setCapaText(data.result?.capaReport ?? '')
      }
    } catch (err) {
      setErrorMsg(String(err))
      setStatus('error')
    }
  }

  async function handleConfirm(approved: boolean) {
    if (!sessionData) return
    if (approved && !approverName.trim()) return
    setConfirming(true)
    try {
      const res = await fetch('/api/agent/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionData,
          approved,
          approvedBy: approverName.trim() || undefined,
          approverComment: approverComment.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? (isEn ? 'Confirm error' : '確認エラー'))
        setStatus('error')
        return
      }
      setSteps(data.steps ?? [])
      setResult(data.result ?? null)
      if (approved) {
        setStatus('completed')
        setCapaText(data.result?.capaReport ?? '')
      } else {
        setStatus('rejected')
      }
    } catch (err) {
      setErrorMsg(String(err))
      setStatus('error')
    } finally {
      setConfirming(false)
    }
  }

  async function handleCopy() {
    if (!capaText) return
    try {
      await navigator.clipboard.writeText(capaText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-2xl rounded-t-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isEn ? 'AI Agent Response' : 'AI エージェント対応'}
              </h2>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                {isEn ? 'Automated foreign matter incident flow' : '異物事故の自律対応フロー'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-6">

          {/* Step timeline */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              {isEn ? 'Steps' : 'ステップ'}
            </p>
            <div className="space-y-2">
              {steps.map((step, i) => {
                const label = TOOL_LABELS[step.tool]
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0 text-base">
                      {label?.icon ?? '🔧'}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-gray-800">
                        Step {step.step}:&nbsp;
                        <span className="font-medium text-gray-700">
                          {isEn ? label?.en : label?.ja}
                        </span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{step.resultSummary}</p>
                      <p className="text-[9px] text-gray-300 mt-0.5">{step.durationMs}ms</p>
                    </div>
                    <span className="text-green-500 text-sm shrink-0 mt-0.5">✅</span>
                  </div>
                )
              })}

              {/* Running indicator */}
              {status === 'running' && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-orange-600 font-medium">
                    {isEn ? 'Agent is working…' : 'エージェントが対応中…'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Approval gate */}
          {status === 'awaiting_approval' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔐</span>
                <h3 className="text-sm font-bold text-amber-800">
                  {isEn ? 'Approval Required' : '責任者の承認が必要です'}
                </h3>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                {isEn
                  ? 'Urgency is HIGH. A manager must approve before the agent proceeds with CAPA and incident record.'
                  : '緊急度「高」のため、CAPA報告書の作成・異物記録の前に責任者の承認が必要です。'}
              </p>

              {result?.checklistSummary && (
                <div className="bg-white rounded-xl border border-amber-200 p-2.5">
                  <p className="text-[10px] font-semibold text-amber-700 mb-1">
                    {isEn ? 'Checklist summary:' : 'チェックリスト概要:'}
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed">{result.checklistSummary}</p>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  value={approverName}
                  onChange={e => setApproverName(e.target.value)}
                  placeholder={isEn ? 'Approver name (required)' : '承認者名（必須）'}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 placeholder-gray-400"
                />
                <input
                  type="text"
                  value={approverComment}
                  onChange={e => setApproverComment(e.target.value)}
                  placeholder={isEn ? 'Comment (optional)' : 'コメント（任意）'}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 placeholder-gray-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={confirming || !approverName.trim()}
                  className="flex-1 py-3 bg-orange-500 text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-40 shadow-sm"
                >
                  {confirming
                    ? (isEn ? 'Processing…' : '処理中…')
                    : (isEn ? '✅ Approve & Continue' : '✅ 承認して続行')}
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={confirming}
                  className="px-4 py-3 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {isEn ? 'Reject' : '却下'}
                </button>
              </div>
            </div>
          )}

          {/* Rejected */}
          {status === 'rejected' && result && (
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-semibold mb-1">
                {isEn ? 'Response rejected' : '対応を却下しました'}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Completed results */}
          {status === 'completed' && result && (
            <div className="space-y-4">
              {/* Checklist */}
              {result.checklist && result.checklist.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    {isEn ? '📋 Action Checklist' : '📋 対応チェックリスト'}
                  </p>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                    {result.checklist.map((item, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-3 px-3.5 py-3 cursor-pointer active:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems[i] ?? false}
                          onChange={e => setCheckedItems(prev => ({ ...prev, [i]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 rounded accent-orange-500 shrink-0"
                        />
                        <span className={`text-xs leading-relaxed ${checkedItems[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* CAPA report */}
              {capaText && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      {isEn ? '📝 CAPA Report Draft' : '📝 CAPA 報告書ドラフト'}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCopy}
                        className="text-[10px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg active:scale-95 transition-all font-medium"
                      >
                        {copied ? (isEn ? '✅ Copied' : '✅ コピー完了') : (isEn ? '📋 Copy' : '📋 コピー')}
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="text-[10px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg active:scale-95 transition-all font-medium"
                      >
                        {isEn ? '🖨️ Print' : '🖨️ 印刷'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={capaText}
                    onChange={e => setCapaText(e.target.value)}
                    className="w-full text-xs p-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400/40 resize-none leading-relaxed"
                    rows={10}
                  />
                </div>
              )}

              {/* Saved confirmation */}
              {result.savedIncidentId && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">✅</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-green-700">
                        {isEn ? 'Incident saved successfully' : '異物一覧に記録しました'}
                      </p>
                      <p className="text-[10px] text-green-600 font-mono">ID: {result.savedIncidentId}</p>
                    </div>
                  </div>
                  <a
                    href="/list"
                    className="shrink-0 text-xs px-3 py-2 bg-green-600 text-white rounded-xl font-semibold active:scale-95 transition-all"
                  >
                    {isEn ? 'View List →' : '一覧を見る →'}
                  </a>
                </div>
              )}

              {/* Summary */}
              {result.summary && (
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2.5">
              <p className="text-xs font-semibold text-red-700">
                {isEn ? 'An error occurred' : 'エラーが発生しました'}
              </p>
              <p className="text-[10px] text-red-600 leading-relaxed break-all">{errorMsg}</p>
              <button
                onClick={() => void runAgent()}
                className="text-xs px-3 py-2 bg-red-500 text-white rounded-xl font-medium active:scale-95 transition-all"
              >
                {isEn ? 'Retry' : 'やり直す'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
