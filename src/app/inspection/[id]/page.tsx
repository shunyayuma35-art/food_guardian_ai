'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import Navigation from '@/components/Navigation'
import toast from 'react-hot-toast'
import {
  DEVICE_TYPE_LABELS, INSPECTION_RESULT_LABELS,
  type InspectionRecord,
} from '@/lib/types'
import { getInspection, deleteInspection } from '@/lib/firestore'

const RESULT_STYLE: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 border-green-200',
  fail: 'bg-red-100 text-red-600 border-red-200',
  adjusted: 'bg-amber-100 text-amber-700 border-amber-200',
}

function CheckRow({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
        {value ? '✅ OK' : '❌ NG'}
      </span>
    </div>
  )
}

export default function InspectionDetailPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [record, setRecord] = useState<InspectionRecord | null>(null)
  const [fetching, setFetching] = useState(true)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!params.id) return
    getInspection(params.id)
      .then((data) => setRecord(data))
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [params.id])

  async function handleDelete() {
    if (!record) return
    try {
      await deleteInspection(record.id)
      toast.success(t('toast.deleted'))
      router.replace('/inspection')
    } catch {
      toast.error(t('toast.deleteFailed'))
    }
  }

  function downloadCSV() {
    if (!record) return
    const isMetal = record.deviceType === 'metal_detector'
    const rows = [
      ['項目', '内容'],
      ['機器種別', DEVICE_TYPE_LABELS[record.deviceType]],
      ['機器名', record.deviceName],
      ['ライン番号', record.lineNumber || ''],
      ['工場名', record.factory || ''],
      ['製品名', record.productName],
      ['ロット番号', record.lotNumber],
      ['検査日', record.inspectionDate],
      ['担当者', record.inspector],
      ...(isMetal ? [
        ['Fe感度', record.sensitivity.fe || ''],
        ['SUS感度', record.sensitivity.sus || ''],
        ['Non-Fe感度', record.sensitivity.nonFe || ''],
      ] : [['X線閾値', record.sensitivity.xrayThreshold || '']]),
      ['始業 確認時刻', record.startCheck.time],
      ['始業 Fe/検出', record.startCheck.fePassed === null ? '' : record.startCheck.fePassed ? 'OK' : 'NG'],
      ...(isMetal ? [
        ['始業 SUS', record.startCheck.susPassed === null ? '' : record.startCheck.susPassed ? 'OK' : 'NG'],
        ['始業 Non-Fe', record.startCheck.nonFePassed === null ? '' : record.startCheck.nonFePassed ? 'OK' : 'NG'],
      ] : []),
      ['始業 合否', record.startCheck.passed ? '合格' : '不合格'],
      ['終業 確認時刻', record.endCheck.time],
      ['終業 Fe/検出', record.endCheck.fePassed === null ? '' : record.endCheck.fePassed ? 'OK' : 'NG'],
      ...(isMetal ? [
        ['終業 SUS', record.endCheck.susPassed === null ? '' : record.endCheck.susPassed ? 'OK' : 'NG'],
        ['終業 Non-Fe', record.endCheck.nonFePassed === null ? '' : record.endCheck.nonFePassed ? 'OK' : 'NG'],
      ] : []),
      ['終業 合否', record.endCheck.passed ? '合格' : '不合格'],
      ['排除件数', String(record.rejectCount)],
      ['排除内容', record.rejectDetails || ''],
      ['総合判定', INSPECTION_RESULT_LABELS[record.result]],
      ['是正処置', record.correctionAction || ''],
      ['コメント', record.comment || ''],
    ]
    const bom = '﻿'
    const csv = bom + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `検査記録_${record.deviceName}_${record.inspectionDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('insp.csvOk'))
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{t('insp.notFound')}</p>
        <button onClick={() => router.replace('/inspection')} className="btn-secondary text-sm">
          {t('insp.backToList')}
        </button>
      </div>
    )
  }

  const isMetal = record.deviceType === 'metal_detector'

  return (
    <div className="min-h-screen pb-28">
      {/* 削除確認 */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-5">
          <div className="card p-6 w-full max-w-sm">
            <p className="font-extrabold text-gray-800 text-lg mb-2 text-center">{t('insp.deleteConfirmTitle')}</p>
            <p className="text-gray-500 text-sm mb-5 text-center">{t('insp.deleteConfirmMsg')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 btn-secondary text-sm">{t('common.cancel')}</button>
              <button onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-md shadow-red-200">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white/85 backdrop-blur-xl border-b border-teal-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/inspection')} className="back-btn">←</button>
          <span className="text-sm font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
            {record.deviceType === 'metal_detector' ? '🧲' : '☢️'} {DEVICE_TYPE_LABELS[record.deviceType]}
          </span>
          <button onClick={() => window.print()}
            className="text-xs text-gray-500 hover:text-teal-500 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-teal-300 bg-white transition-all">
            {t('insp.pdfPrint')}
          </button>
        </div>
      </header>

      {/* 印刷用ヘッダー */}
      <div className="hidden print:block p-6 border-b">
        <h1 className="text-2xl font-bold">{t('insp.printHeader')}{DEVICE_TYPE_LABELS[record.deviceType]}</h1>
        <p className="text-sm text-gray-600">{t('insp.printDate')} {record.inspectionDate} / {t('insp.printDevice')} {record.deviceName}</p>
        <p className="text-xs text-gray-400 mt-1">{t('insp.printIssued')} {new Date().toLocaleString()}</p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">

        {/* 総合判定バナー */}
        <div className={`rounded-2xl p-4 border ${RESULT_STYLE[record.result]} flex items-center justify-between`}>
          <div>
            <p className="text-xs font-semibold opacity-70">{t('insp.overallJudgment')}</p>
            <p className="text-2xl font-extrabold">{INSPECTION_RESULT_LABELS[record.result]}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70">{t('insp.testpieceLabel')}</p>
            <p className="text-sm font-bold">
              {t('insp.startLabel')} {record.startCheck.passed ? t('insp.passShort') : t('insp.failShort')} ／
              {t('insp.endLabel')} {record.endCheck.passed ? t('insp.passShort') : t('insp.failShort')}
            </p>
          </div>
        </div>

        {/* 機器・製品情報 */}
        <div className="card p-4">
          <p className="section-title">{t('insp.basicInfo')}</p>
          <dl className="space-y-2">
            {[
              { k: 'deviceName',   label: t('insp.deviceName'),  value: record.deviceName },
              { k: 'lineNumber',   label: t('record.lineNo'),     value: record.lineNumber },
              { k: 'factory',      label: t('record.factory'),    value: record.factory },
              { k: 'productName',  label: t('insp.productName'),  value: record.productName },
              { k: 'lotNumber',    label: t('record.lotNo'),      value: record.lotNumber },
              { k: 'date',         label: t('insp.date'),         value: record.inspectionDate },
              { k: 'inspector',    label: t('insp.inspector'),    value: record.inspector },
            ].filter(({ value }) => value).map(({ k, label, value }) => (
              <div key={k} className="flex gap-3">
                <dt className="text-xs text-gray-400 font-semibold w-24 shrink-0">{label}</dt>
                <dd className="text-sm text-gray-800 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 感度設定 */}
        {(record.sensitivity.fe || record.sensitivity.sus || record.sensitivity.nonFe || record.sensitivity.xrayThreshold) && (
          <div className="card p-4">
            <p className="section-title">{t('insp.sensitivitySection')}</p>
            {isMetal ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { k: 'fe',    label: t('insp.feLabel'),  value: record.sensitivity.fe },
                  { k: 'sus',   label: t('insp.susLabel'), value: record.sensitivity.sus },
                  { k: 'nonFe', label: 'Non-Fe',           value: record.sensitivity.nonFe },
                ].filter(({ value }) => value).map(({ k, label, value }) => (
                  <div key={k} className="bg-teal-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                    <p className="text-sm font-extrabold text-teal-700 mt-1">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-800">{record.sensitivity.xrayThreshold}</p>
            )}
          </div>
        )}

        {/* テストピース始業 */}
        <div className="card p-4 border-l-4 border-teal-400">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('insp.startTestpiece')}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              record.startCheck.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {record.startCheck.passed ? t('insp.pass') : t('insp.fail')}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{t('insp.checkTime')}: {record.startCheck.time}</p>
          <div className="space-y-1.5">
            {isMetal ? (
              <>
                <CheckRow label={t('insp.feLabel')} value={record.startCheck.fePassed} />
                <CheckRow label={t('insp.susLabel')} value={record.startCheck.susPassed} />
                <CheckRow label="Non-Fe" value={record.startCheck.nonFePassed} />
              </>
            ) : (
              <CheckRow label={t('insp.detectConfirm')} value={record.startCheck.fePassed} />
            )}
          </div>
          {record.startCheck.note && (
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">{record.startCheck.note}</p>
          )}
        </div>

        {/* テストピース終業 */}
        <div className="card p-4 border-l-4 border-slate-400">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t('insp.endTestpiece')}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              record.endCheck.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {record.endCheck.passed ? t('insp.pass') : t('insp.fail')}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{t('insp.checkTime')}: {record.endCheck.time}</p>
          <div className="space-y-1.5">
            {isMetal ? (
              <>
                <CheckRow label={t('insp.feLabel')} value={record.endCheck.fePassed} />
                <CheckRow label={t('insp.susLabel')} value={record.endCheck.susPassed} />
                <CheckRow label="Non-Fe" value={record.endCheck.nonFePassed} />
              </>
            ) : (
              <CheckRow label={t('insp.detectConfirm')} value={record.endCheck.fePassed} />
            )}
          </div>
          {record.endCheck.note && (
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">{record.endCheck.note}</p>
          )}
        </div>

        {/* 排除・是正 */}
        {(record.rejectCount > 0 || record.correctionAction || record.comment) && (
          <div className="card p-4">
            <p className="section-title">{t('insp.rejectSection')}</p>
            <div className="space-y-3">
              {record.rejectCount > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('insp.rejectCountLabel')}</p>
                  <p className="text-2xl font-extrabold text-red-500">{record.rejectCount}<span className="text-sm text-gray-500 ml-1">{t('insp.unit')}</span></p>
                  {record.rejectDetails && <p className="text-sm text-gray-700 mt-1">{record.rejectDetails}</p>}
                </div>
              )}
              {record.correctionAction && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('insp.correctionActionLabel')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.correctionAction}</p>
                </div>
              )}
              {record.comment && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">{t('insp.inspCommentLabel')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.comment}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* エクスポート */}
        <div className="card p-4 no-print">
          <p className="section-title">{t('insp.exportSection')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => window.print()}
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-green-100 text-green-700 font-bold text-xs hover:bg-green-200 transition-all">
              {t('insp.pdfPrint')}
            </button>
            <button onClick={downloadCSV}
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-teal-100 text-teal-700 font-bold text-xs hover:bg-teal-200 transition-all">
              {t('insp.csvExport')}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {t('insp.registered')} {new Date(record.createdAt).toLocaleString()}
        </p>

        <button onClick={() => setShowDelete(true)}
          className="w-full py-3.5 text-red-500 border border-red-200 hover:border-red-400 rounded-2xl text-sm bg-red-50/50 hover:bg-red-50 font-semibold no-print transition-all">
          {t('insp.deleteBtn')}
        </button>
      </div>

      <Navigation />
    </div>
  )
}
