'use client'

import { useEffect, useRef, useState } from 'react'

export interface BBox { x: number; y: number; w: number; h: number }

interface Props {
  imageDataUrl: string
  bbox: BBox
  isEn?: boolean
  sizeEstimate?: string
}

export default function ForeignMatterBBoxView({ imageDataUrl, bbox, isEn = false, sizeEstimate }: Props) {
  const zoomRef = useRef<HTMLCanvasElement>(null)
  const fullRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth
      const ih = img.naturalHeight

      // ── Zoom canvas: crop to bbox with 15% padding ──
      const pad = 0.12
      const cx = Math.max(0, bbox.x - pad)
      const cy = Math.max(0, bbox.y - pad)
      const cw = Math.min(1 - cx, bbox.w + pad * 2)
      const ch = Math.min(1 - cy, bbox.h + pad * 2)
      const zc = zoomRef.current
      if (zc) {
        const outW = 360
        const outH = Math.max(60, Math.round(outW * (ch / cw)))
        zc.width = outW
        zc.height = outH
        const ctx = zc.getContext('2d')!
        ctx.drawImage(img, cx * iw, cy * ih, cw * iw, ch * ih, 0, 0, outW, outH)
        // Bbox on zoom view
        const bx = ((bbox.x - cx) / cw) * outW
        const by = ((bbox.y - cy) / ch) * outH
        const bw = (bbox.w / cw) * outW
        const bh = (bbox.h / ch) * outH
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.strokeRect(bx, by, bw, bh)
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 10
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 1.5
        ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3)
        ctx.shadowBlur = 0
      }

      // ── Full canvas: whole image + bbox overlay ──
      const fc = fullRef.current
      if (fc) {
        const maxW = 400
        const scale = Math.min(1, maxW / iw)
        const dw = Math.round(iw * scale)
        const dh = Math.round(ih * scale)
        fc.width = dw
        fc.height = dh
        const ctx = fc.getContext('2d')!
        ctx.drawImage(img, 0, 0, dw, dh)
        const rx = bbox.x * dw
        const ry = bbox.y * dh
        const rw = bbox.w * dw
        const rh = bbox.h * dh
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 8
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rx + 1.5, ry + 1.5, rw - 3, rh - 3)
        ctx.shadowBlur = 0
      }

      setReady(true)
    }
    img.src = imageDataUrl
  }, [imageDataUrl, bbox])

  const spinner = (
    <div className="flex items-center justify-center h-24">
      <span className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // 「参照なし」メッセージかどうかを判定
  const hasNoRef = sizeEstimate
    ? /参照なし|No reference/i.test(sizeEstimate)
    : false

  return (
    <div className="mt-3 space-y-2">
      {/* サイズ推定 */}
      {sizeEstimate && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${
          hasNoRef
            ? 'bg-gray-50 border border-gray-200 text-gray-500'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          <span className="shrink-0 mt-0.5">{hasNoRef ? '📏' : '📐'}</span>
          <div>
            <span className="font-semibold">{isEn ? 'Size' : '大きさ'}: </span>
            {sizeEstimate}
            {!hasNoRef && (
              <span className="ml-1 text-[10px] text-amber-600">
                ({isEn ? 'estimated value — actual measurement required' : '推定値・正確な測定は実測が必要'})
              </span>
            )}
          </div>
        </div>
      )}
      {/* ズーム拡大 */}
      <div className="rounded-xl overflow-hidden border border-red-200 bg-black">
        <div className="px-2.5 py-1.5 bg-gray-950 flex items-center gap-1.5">
          <span className="text-red-400 text-xs">🔍</span>
          <span className="text-[10px] font-mono text-gray-300 font-semibold">
            {isEn ? 'Auto-zoom: Foreign Matter' : '異物 自動ズーム'}
          </span>
          <span className="text-[9px] text-gray-600 ml-auto">
            {isEn ? '(AI estimated position)' : '（AI推定位置）'}
          </span>
        </div>
        {!ready && spinner}
        <canvas ref={zoomRef} className="w-full block" style={{ display: ready ? 'block' : 'none' }} />
      </div>

      {/* 元画像（証跡） */}
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
        <div className="px-2.5 py-1.5 bg-gray-950 flex items-center gap-1.5">
          <span className="text-xs">📷</span>
          <span className="text-[10px] font-mono text-gray-400">
            {isEn ? 'Evidence photo (original)' : '証跡写真（元画像）'}
          </span>
        </div>
        {!ready && spinner}
        <canvas ref={fullRef} className="w-full block" style={{ display: ready ? 'block' : 'none' }} />
      </div>
    </div>
  )
}
