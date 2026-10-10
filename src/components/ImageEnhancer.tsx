'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { enhanceImage, DEFAULT_PARAMS, type EnhanceParams } from '@/lib/enhanceImage'
import { useLang } from '@/context/LanguageContext'

interface Props {
  imageDataUrl: string
  onEnhanced: (base64: string, dataUrl: string) => void
}

export default function ImageEnhancer({ imageDataUrl, onEnhanced }: Props) {
  const [params, setParams] = useState<EnhanceParams>(DEFAULT_PARAMS)
  const [enhanced, setEnhanced] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t } = useLang()

  const SLIDERS: {
    key: keyof EnhanceParams
    label: string
    min: number
    max: number
    step: number
  }[] = [
    { key: 'sharpness',  label: t('enh.sharp'),    min: 0,   max: 3,   step: 0.1  },
    { key: 'contrast',   label: t('enh.contrast'),  min: 0.5, max: 2,   step: 0.05 },
    { key: 'brightness', label: t('enh.brightness'), min: 0.5, max: 1.8, step: 0.05 },
    { key: 'zoom',       label: t('enh.zoom'),       min: 1,   max: 4,   step: 0.5  },
  ]

  const process = useCallback(
    async (p: EnhanceParams) => {
      setProcessing(true)
      try {
        const result = await enhanceImage(imageDataUrl, p)
        setEnhanced(result.dataUrl)
        onEnhanced(result.base64, result.dataUrl)
      } catch (e) {
        console.error('[ImageEnhancer]', e)
      } finally {
        setProcessing(false)
      }
    },
    [imageDataUrl, onEnhanced]
  )

  // Re-process with defaults whenever the source image changes
  useEffect(() => {
    setParams(DEFAULT_PARAMS)
    process(DEFAULT_PARAMS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl])

  const handleChange = (key: keyof EnhanceParams, value: number) => {
    const next = { ...params, [key]: value }
    setParams(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => process(next), 150)
  }

  const handleDownload = () => {
    if (!enhanced) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `enhanced_${Date.now()}.png`
      a.click()
    }
    img.src = enhanced
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-3 space-y-3 mb-2">
      {/* Side-by-side preview */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 text-center mb-1">{t('enh.original')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageDataUrl}
            alt="original"
            className="w-full max-h-32 object-contain rounded-xl bg-gray-50"
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-orange-500 text-center mb-1">
            {t('enh.enhanced')}{processing && ' ⏳'}
          </p>
          {enhanced ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={enhanced}
              alt="enhanced"
              className={`w-full max-h-32 object-contain rounded-xl bg-gray-50 transition-opacity ${
                processing ? 'opacity-50' : 'opacity-100'
              }`}
            />
          ) : (
            <div className="w-full max-h-32 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-1.5">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="flex-1 accent-orange-500 h-1"
            />
            <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums">
              {params[key].toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* PNG download */}
      <button
        onClick={handleDownload}
        disabled={!enhanced}
        className="w-full py-1.5 text-xs font-semibold text-orange-600 border border-orange-300 bg-white rounded-xl hover:bg-orange-50 active:scale-95 transition-all disabled:opacity-40"
      >
        {t('enh.saveBtn')}
      </button>

      {/* Warning */}
      <p className="text-[9px] text-amber-700 leading-relaxed bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
        {t('enh.caution')}
      </p>
    </div>
  )
}
