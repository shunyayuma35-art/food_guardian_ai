'use client'

import { useState, useEffect, useRef } from 'react'
import { enhanceImage, DEFAULT_PARAMS } from '@/lib/enhanceImage'
import CollationView from '@/components/CollationView'
import { useLang } from '@/context/LanguageContext'

interface Props {
  originalDataUrl: string
  enhancedDataUrl?: string | null
}

export default function ComparisonPanel({ originalDataUrl, enhancedDataUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [origEnhanced, setOrigEnhanced] = useState<string | null>(null)
  const [refDataUrl, setRefDataUrl] = useState<string | null>(null)
  const [refEnhanced, setRefEnhanced] = useState<string | null>(null)
  const [processingOrig, setProcessingOrig] = useState(false)
  const [processingRef, setProcessingRef] = useState(false)
  const [showCollation, setShowCollation] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)
  const { t } = useLang()

  // Use provided enhancedDataUrl or compute from original
  useEffect(() => {
    if (enhancedDataUrl) {
      setOrigEnhanced(enhancedDataUrl)
      return
    }
    let cancelled = false
    setProcessingOrig(true)
    enhanceImage(originalDataUrl, DEFAULT_PARAMS)
      .then(r => { if (!cancelled) setOrigEnhanced(r.dataUrl) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProcessingOrig(false) })
    return () => { cancelled = true }
  }, [originalDataUrl, enhancedDataUrl])

  // Enhance reference image whenever it changes
  useEffect(() => {
    if (!refDataUrl) { setRefEnhanced(null); return }
    let cancelled = false
    setProcessingRef(true)
    enhanceImage(refDataUrl, DEFAULT_PARAMS)
      .then(r => { if (!cancelled) setRefEnhanced(r.dataUrl) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProcessingRef(false) })
    return () => { cancelled = true }
  }, [refDataUrl])

  function handleRefChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRefDataUrl(ev.target?.result as string ?? null)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 bg-teal-50 rounded-xl hover:bg-teal-100 active:scale-95 transition-all"
      >
        {t('comp.openBtn')}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-teal-700">{t('comp.header')}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {t('common.close')}
        </button>
      </div>

      {/* 2×2 grid:  top row = originals, bottom row = enhanced */}
      <div className="grid grid-cols-2 gap-2">
        {/* ① 元画像（証跡） */}
        <Cell label={t('comp.cell1')} labelCls="text-gray-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalDataUrl}
            alt="original"
            className="w-full max-h-36 object-contain rounded-lg bg-gray-50"
          />
        </Cell>

        {/* ③ 参考画像 */}
        <Cell label={t('comp.cell3')} labelCls="text-teal-600">
          {refDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={refDataUrl}
              alt="reference"
              className="w-full max-h-36 object-contain rounded-lg bg-gray-50"
            />
          ) : (
            <button
              type="button"
              onClick={() => refInputRef.current?.click()}
              className="w-full h-28 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors"
            >
              <span className="text-2xl">📷</span>
              <span className="text-[10px] text-teal-600 font-semibold">{t('comp.addRef')}</span>
            </button>
          )}
        </Cell>

        {/* ② 元画像・鮮明化後 */}
        <Cell label={t('comp.cell2')} labelCls="text-orange-500">
          {processingOrig || !origEnhanced ? (
            <Placeholder />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={origEnhanced}
              alt="original enhanced"
              className="w-full max-h-36 object-contain rounded-lg bg-gray-50"
            />
          )}
        </Cell>

        {/* ④ 参考画像・鮮明化後 */}
        <Cell label={t('comp.cell4')} labelCls="text-teal-500">
          {!refDataUrl ? (
            <Placeholder text={t('comp.refWaiting')} />
          ) : processingRef || !refEnhanced ? (
            <Placeholder />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={refEnhanced}
              alt="reference enhanced"
              className="w-full max-h-36 object-contain rounded-lg bg-gray-50"
            />
          )}
        </Cell>
      </div>

      {/* Replace reference button */}
      {refDataUrl && (
        <button
          type="button"
          onClick={() => refInputRef.current?.click()}
          className="w-full py-1 text-[10px] font-medium text-teal-600 border border-teal-200 bg-white rounded-lg hover:bg-teal-50 active:scale-95 transition-all"
        >
          {t('comp.changeRef')}
        </button>
      )}

      {!refDataUrl && (
        <p className="text-[10px] text-teal-600 text-center">
          {t('comp.emptyHint')}
        </p>
      )}

      {/* Collation view toggle */}
      {refDataUrl && (
        <button
          type="button"
          onClick={() => setShowCollation(s => !s)}
          className={`w-full py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
            showCollation
              ? 'text-[#6dd39b] border-[#6dd39b]/30 bg-gray-800/80'
              : 'text-teal-700 border-teal-300 bg-teal-50 hover:bg-teal-100'
          }`}
        >
          {showCollation ? t('comp.closeView') : t('comp.openView')}
        </button>
      )}

      {/* Forensic collation view */}
      {showCollation && refDataUrl && (
        <CollationView evidenceUrl={originalDataUrl} referenceUrl={refDataUrl} />
      )}

      <p className="text-[9px] text-gray-400 text-center leading-relaxed">
        {t('comp.caution')}
      </p>

      <input
        ref={refInputRef}
        type="file"
        accept="image/*"
        onChange={handleRefChange}
        className="hidden"
      />
    </div>
  )
}

function Cell({ label, labelCls, children }: { label: string; labelCls: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-[10px] font-semibold text-center mb-1 ${labelCls}`}>{label}</p>
      {children}
    </div>
  )
}

function Placeholder({ text }: { text?: string }) {
  return (
    <div className="w-full h-28 rounded-lg bg-gray-100 flex items-center justify-center">
      {text ? (
        <span className="text-[10px] text-gray-400">{text}</span>
      ) : (
        <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}
