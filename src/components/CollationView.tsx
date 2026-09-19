'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Constants ─────────────────────────────────────────────────────────
const CW = 600
const CH = 360
const DEF_THR = 90
const GREEN: [number, number, number] = [55, 211, 155]
const RED: [number, number, number] = [224, 80, 58]
const BLEND_R = Math.round((GREEN[0] * 2 + RED[0]) / 3)
const BLEND_G = Math.round((GREEN[1] * 2 + RED[1]) / 3)
const BLEND_B = Math.round((GREEN[2] * 2 + RED[2]) / 3)

// ─── Types ─────────────────────────────────────────────────────────────
interface ImageAdj { ox: number; oy: number; sc: number }
interface PixelInfo { r: number; g: number; b: number; lum: number; hex: string }
interface Props { evidenceUrl: string; referenceUrl: string }

// ─── Pure helpers ───────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function fitAdj(img: HTMLImageElement): ImageAdj {
  const sc = Math.min(CW / img.naturalWidth, CH / img.naturalHeight, 1)
  return { ox: (CW - img.naturalWidth * sc) / 2, oy: (CH - img.naturalHeight * sc) / 2, sc }
}

function computeEdge(img: HTMLImageElement, adj: ImageAdj, thr: number): Uint8Array {
  const off = document.createElement('canvas')
  off.width = CW; off.height = CH
  const ctx = off.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CW, CH)
  ctx.drawImage(img, adj.ox, adj.oy, img.naturalWidth * adj.sc, img.naturalHeight * adj.sc)
  const px = ctx.getImageData(0, 0, CW, CH).data
  const n = CW * CH
  const gray = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
  }
  const GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const GY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  const edge = new Uint8Array(n)
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        const ny = Math.max(0, Math.min(CH - 1, y + ky))
        for (let kx = -1; kx <= 1; kx++) {
          const nx = Math.max(0, Math.min(CW - 1, x + kx))
          const ki = (ky + 1) * 3 + (kx + 1)
          gx += gray[ny * CW + nx] * GX[ki]
          gy += gray[ny * CW + nx] * GY[ki]
        }
      }
      edge[y * CW + x] = Math.sqrt(gx * gx + gy * gy) > thr ? 1 : 0
    }
  }
  return edge
}

function getPixelInfo(raw: ImageData, adj: ImageAdj, cx: number, cy: number): PixelInfo | null {
  const ix = Math.round((cx - adj.ox) / adj.sc)
  const iy = Math.round((cy - adj.oy) / adj.sc)
  if (ix < 0 || iy < 0 || ix >= raw.width || iy >= raw.height) return null
  const i = (iy * raw.width + ix) * 4
  const r = raw.data[i], g = raw.data[i + 1], b = raw.data[i + 2]
  return {
    r, g, b,
    lum: Math.round(0.299 * r + 0.587 * g + 0.114 * b),
    hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''),
  }
}

// ─── AdjPanel (hoisted to avoid re-mount on parent re-render) ──────────
type AdjKey = 'ox' | 'oy' | 'sc'
const SLIDER_CFG: Record<AdjKey, { label: string; min: number; max: number; step: number }> = {
  ox: { label: 'X', min: -CW, max: CW, step: 1 },
  oy: { label: 'Y', min: -CH, max: CH, step: 1 },
  sc: { label: '拡大', min: 0.1, max: 3, step: 0.05 },
}
const ADJ_KEYS: AdjKey[] = ['ox', 'oy', 'sc']

function AdjPanel({ label, color, adj, onChange }: {
  label: string; color: string; adj: ImageAdj; onChange: (a: ImageAdj) => void
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className={`text-[10px] font-bold font-mono mb-1.5 ${color}`}>{label}</p>
      {ADJ_KEYS.map(key => {
        const cfg = SLIDER_CFG[key]
        return (
          <div key={key} className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] text-gray-500 w-8 shrink-0">{cfg.label}</span>
            <input
              type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={adj[key]}
              onChange={e => onChange({ ...adj, [key]: parseFloat(e.target.value) })}
              className="flex-1 h-0.5 accent-teal-400 cursor-pointer"
            />
            <span className="text-[9px] text-gray-500 w-10 text-right tabular-nums">
              {key === 'sc' ? adj.sc.toFixed(2) : Math.round(adj[key])}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── CollationView ─────────────────────────────────────────────────────
export default function CollationView({ evidenceUrl, referenceUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const evImgRef = useRef<HTMLImageElement | null>(null)
  const refImgRef = useRef<HTMLImageElement | null>(null)
  const evRawRef = useRef<ImageData | null>(null)
  const refRawRef = useRef<ImageData | null>(null)
  const rafRef = useRef<number>(0)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const hasDraggedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [evAdj, setEvAdj] = useState<ImageAdj>({ ox: 0, oy: 0, sc: 1 })
  const [refAdj, setRefAdj] = useState<ImageAdj>({ ox: 0, oy: 0, sc: 1 })
  const [threshold, setThreshold] = useState(DEF_THR)
  const [score, setScore] = useState<number | null>(null)
  const [evPx, setEvPx] = useState<PixelInfo | null>(null)
  const [refPx, setRefPx] = useState<PixelInfo | null>(null)
  const [moveTarget, setMoveTarget] = useState<'ev' | 'ref'>('ev')
  const [isDragging, setIsDragging] = useState(false)
  const [note, setNote] = useState('')

  // Load images
  useEffect(() => {
    let cancelled = false
    setReady(false); setScore(null); setEvPx(null); setRefPx(null)
    Promise.all([loadImg(evidenceUrl), loadImg(referenceUrl)]).then(([ev, rf]) => {
      if (cancelled) return
      evImgRef.current = ev; refImgRef.current = rf
      const storeRaw = (img: HTMLImageElement, r: { current: ImageData | null }) => {
        const off = document.createElement('canvas')
        off.width = img.naturalWidth; off.height = img.naturalHeight
        const c = off.getContext('2d')!; c.drawImage(img, 0, 0)
        r.current = c.getImageData(0, 0, off.width, off.height)
      }
      storeRaw(ev, evRawRef); storeRaw(rf, refRawRef)
      setEvAdj(fitAdj(ev)); setRefAdj(fitAdj(rf))
      setReady(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [evidenceUrl, referenceUrl])

  // Render edge overlay
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !evImgRef.current || !refImgRef.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const ev = evImgRef.current!; const rf = refImgRef.current!
      const evEdge = computeEdge(ev, evAdj, threshold)
      const refEdge = computeEdge(rf, refAdj, threshold)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, CW, CH)
      // Faint ghost of evidence
      ctx.globalAlpha = 0.12
      ctx.drawImage(ev, evAdj.ox, evAdj.oy, ev.naturalWidth * evAdj.sc, ev.naturalHeight * evAdj.sc)
      ctx.globalAlpha = 1
      // Overlay
      const out = ctx.createImageData(CW, CH)
      let bothHit = 0, eitherHit = 0
      for (let i = 0; i < CW * CH; i++) {
        const e = evEdge[i], r = refEdge[i]; const idx = i * 4
        if (e && r) {
          out.data[idx] = BLEND_R; out.data[idx+1] = BLEND_G; out.data[idx+2] = BLEND_B; out.data[idx+3] = 255
          bothHit++; eitherHit++
        } else if (e) {
          out.data[idx] = GREEN[0]; out.data[idx+1] = GREEN[1]; out.data[idx+2] = GREEN[2]; out.data[idx+3] = 210; eitherHit++
        } else if (r) {
          out.data[idx] = RED[0]; out.data[idx+1] = RED[1]; out.data[idx+2] = RED[2]; out.data[idx+3] = 210; eitherHit++
        }
      }
      ctx.putImageData(out, 0, 0)
      setScore(eitherHit > 0 ? Math.round(bothHit / eitherHit * 100) : 0)
      // Corner brackets
      ctx.strokeStyle = `rgba(${GREEN.join(',')},0.55)`; ctx.lineWidth = 1.5
      const L = 14;
      ([[0, 0, 1, 1], [CW, 0, -1, 1], [0, CH, 1, -1], [CW, CH, -1, -1]] as [number,number,number,number][]).forEach(([bx, by, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(bx + sx*L, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy*L); ctx.stroke()
      })
    })
  }, [evAdj, refAdj, threshold])

  useEffect(() => { if (ready) render() }, [ready, render])

  // Canvas interaction
  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRectRef.current!
    return { cx: (e.clientX - r.left) * (CW / r.width), cy: (e.clientY - r.top) * (CH / r.height) }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    canvasRectRef.current = e.currentTarget.getBoundingClientRect()
    hasDraggedRef.current = false
    const adj = moveTarget === 'ev' ? evAdj : refAdj
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: adj.ox, oy: adj.oy }
    setIsDragging(true)
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStartRef.current || !canvasRectRef.current) return
    const sx = CW / canvasRectRef.current.width, sy = CH / canvasRectRef.current.height
    const dx = (e.clientX - dragStartRef.current.x) * sx
    const dy = (e.clientY - dragStartRef.current.y) * sy
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDraggedRef.current = true
    const newAdj = { ...(moveTarget === 'ev' ? evAdj : refAdj), ox: dragStartRef.current.ox + dx, oy: dragStartRef.current.oy + dy }
    moveTarget === 'ev' ? setEvAdj(newAdj) : setRefAdj(newAdj)
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!hasDraggedRef.current && canvasRectRef.current) {
      const { cx, cy } = getCanvasCoords(e)
      setEvPx(evRawRef.current ? getPixelInfo(evRawRef.current, evAdj, cx, cy) : null)
      setRefPx(refRawRef.current ? getPixelInfo(refRawRef.current, refAdj, cx, cy) : null)
    }
    setIsDragging(false); dragStartRef.current = null
  }

  function resetFit() {
    if (evImgRef.current) setEvAdj(fitAdj(evImgRef.current))
    if (refImgRef.current) setRefAdj(fitAdj(refImgRef.current))
  }

  // Export PNG
  function exportPng() {
    const HDR = 68, MAIN = CH, GAP = 10, RGB_H = 80
    const NOTE_H = note.trim() ? 48 : 0, FOOT = 24
    const EW = 800, EH = HDR + MAIN + GAP + RGB_H + NOTE_H + FOOT
    const off = document.createElement('canvas'); off.width = EW; off.height = EH
    const ctx = off.getContext('2d')!

    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, EW, EH)
    // Header band
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, EW, HDR)
    ctx.strokeStyle = `rgb(${GREEN.join(',')})`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, HDR); ctx.lineTo(EW, HDR); ctx.stroke()
    ctx.fillStyle = `rgb(${GREEN.join(',')})`; ctx.font = 'bold 15px monospace'
    ctx.fillText('⬡  FoodEye  COLLATION REPORT', 14, 22)
    ctx.fillStyle = '#8b949e'; ctx.font = '11px monospace'
    ctx.fillText(`生成日時: ${new Date().toLocaleString('ja-JP')}`, 14, 42)
    if (score !== null) {
      const sc = score; const sc2 = sc >= 50 ? `rgb(${GREEN.join(',')})` : sc >= 25 ? '#fbbf24' : '#f87171'
      ctx.fillStyle = sc2; ctx.font = 'bold 13px monospace'
      ctx.fillText(`輪郭一致度: ${sc}%（参考値）`, 14, 62)
    }
    // Legend
    const lgItems: [string, string][] = [
      [`rgb(${GREEN.join(',')})`, '証跡の輪郭'],
      [`rgb(${RED.join(',')})`, '参考の輪郭'],
      [`rgb(${BLEND_R},${BLEND_G},${BLEND_B})`, '重なり'],
    ]
    lgItems.forEach(([c, l], i) => {
      ctx.fillStyle = c; ctx.fillRect(EW - 130, 10 + i * 19, 10, 10)
      ctx.fillStyle = '#8b949e'; ctx.font = '10px monospace'
      ctx.fillText(l, EW - 116, 19 + i * 19)
    })
    // Main canvas
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, HDR, EW, MAIN)
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; ctx.strokeRect(0, HDR, EW, MAIN)
    // Corner brackets on export
    ctx.strokeStyle = `rgba(${GREEN.join(',')},0.45)`; ctx.lineWidth = 2; const bL = 22;
    ([[0, HDR, 1, 1], [EW, HDR, -1, 1], [0, HDR+MAIN, 1, -1], [EW, HDR+MAIN, -1, -1]] as [number,number,number,number][]).forEach(([bx, by, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(bx+sx*bL, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by+sy*bL); ctx.stroke()
    })
    // RGB section
    const ry = HDR + MAIN + GAP
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, ry, EW, RGB_H)
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; ctx.strokeRect(0, ry, EW, RGB_H)
    ctx.fillStyle = '#8b949e'; ctx.font = 'bold 10px monospace'; ctx.fillText('RGB / 輝度 比較', 14, ry + 16)
    const colLabels = ['R', 'G', 'B', '輝度', 'HEX']
    const colXs = [90, 135, 180, 230, 295]
    colLabels.forEach((c, i) => { ctx.fillStyle = '#555'; ctx.font = '10px monospace'; ctx.fillText(c, colXs[i], ry + 16) })
    if (evPx) {
      ctx.fillStyle = `rgb(${GREEN.join(',')})`; ctx.font = 'bold 10px monospace'; ctx.fillText('証跡', 14, ry + 36)
      ;[evPx.r, evPx.g, evPx.b, evPx.lum, evPx.hex.toUpperCase()].forEach((v, i) => {
        ctx.fillStyle = '#e6edf3'; ctx.font = '10px monospace'; ctx.fillText(String(v), colXs[i], ry + 36)
      })
      ctx.fillStyle = evPx.hex; ctx.fillRect(colXs[4] + 46, ry + 26, 12, 12)
    }
    if (refPx) {
      ctx.fillStyle = `rgb(${RED.join(',')})`; ctx.font = 'bold 10px monospace'; ctx.fillText('参考', 14, ry + 58)
      ;[refPx.r, refPx.g, refPx.b, refPx.lum, refPx.hex.toUpperCase()].forEach((v, i) => {
        ctx.fillStyle = '#e6edf3'; ctx.font = '10px monospace'; ctx.fillText(String(v), colXs[i], ry + 58)
      })
      ctx.fillStyle = refPx.hex; ctx.fillRect(colXs[4] + 46, ry + 48, 12, 12)
    }
    if (!evPx && !refPx) { ctx.fillStyle = '#555'; ctx.font = '10px monospace'; ctx.fillText('（色選択なし）', 14, ry + 36) }
    // Note
    if (note.trim()) {
      const ny = ry + RGB_H
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, ny, EW, NOTE_H)
      ctx.strokeStyle = '#30363d'; ctx.strokeRect(0, ny, EW, NOTE_H)
      ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 10px monospace'; ctx.fillText('所見:', 14, ny + 16)
      ctx.fillStyle = '#e6edf3'; ctx.font = '10px monospace'
      const maxW = EW - 75; let pos = 0, line = 0; const txt = note.trim()
      while (pos < txt.length && line < 2) {
        let end = txt.length
        while (ctx.measureText(txt.substring(pos, end)).width > maxW && end > pos + 1) end--
        ctx.fillText(txt.substring(pos, end), 62, ny + 16 + line * 16); pos = end; line++
      }
    }
    // Footer
    const fy = EH - FOOT
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, fy, EW, FOOT)
    ctx.fillStyle = '#444'; ctx.font = '9px monospace'
    ctx.fillText('※本レポートは目視照合支援の参考値であり、法的証拠能力・科学的同定能力はありません。確定診断には外部専門機関の鑑定が必要です。', 14, fy + 15)
    // Download
    const a = document.createElement('a')
    a.href = off.toDataURL('image/png')
    a.download = `foodeye_collation_${Date.now()}.png`; a.click()
  }

  const scoreColor = score === null ? '' : score >= 50 ? 'text-[#6dd39b]' : score >= 25 ? 'text-amber-400' : 'text-red-400'
  const scoreBarBg = score === null ? '' : score >= 50 ? `rgb(${GREEN.join(',')})` : score >= 25 ? '#fbbf24' : '#f87171'
  const moveTargets: Array<['ev' | 'ref', string, string, string]> = [
    ['ev', '証跡', 'text-[#6dd39b]', 'border-[#6dd39b]/30'],
    ['ref', '参考', 'text-red-400', 'border-red-400/30'],
  ]
  const rgbRows = [
    { label: '証跡', cls: 'text-[#6dd39b]', px: evPx },
    { label: '参考', cls: 'text-red-400', px: refPx },
  ]

  return (
    <div className="bg-gray-900 text-gray-100 rounded-2xl p-4 space-y-3 border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[#6dd39b] font-mono tracking-wider">⬡ 輪郭重ね照合ビュー</p>
          <p className="text-[9px] text-gray-500 mt-0.5">クリック → RGB取得　ドラッグ → 画像移動</p>
        </div>
        {score !== null && (
          <div className="text-right">
            <p className={`text-xl font-bold tabular-nums font-mono ${scoreColor}`}>{score}%</p>
            <p className="text-[9px] text-gray-500">輪郭一致度（参考値）</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px] flex-wrap">
        {[
          [`rgb(${GREEN.join(',')})`, '証跡の輪郭（緑）'],
          [`rgb(${RED.join(',')})`, '参考の輪郭（赤）'],
          [`rgb(${BLEND_R},${BLEND_G},${BLEND_B})`, '重なり部分'],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-gray-700" style={{ background: c }} />
            <span className="text-gray-400">{l}</span>
          </span>
        ))}
      </div>

      {/* Canvas */}
      {!ready ? (
        <div className="w-full flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700/50" style={{ height: 200 }}>
          <span className="w-6 h-6 border-2 border-[#6dd39b] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <canvas
          ref={canvasRef} width={CW} height={CH}
          className={`w-full rounded-xl border border-gray-700/50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          style={{ aspectRatio: `${CW}/${CH}`, background: '#0a0a0a', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setIsDragging(false); dragStartRef.current = null }}
        />
      )}

      {/* Move target + Reset */}
      {ready && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 shrink-0">ドラッグ対象:</span>
          <div className="flex gap-1">
            {moveTargets.map(([t, l, tc, bc]) => (
              <button key={t} type="button" onClick={() => setMoveTarget(t)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  moveTarget === t ? `${tc} bg-gray-700 ${bc}` : 'text-gray-500 bg-gray-800 border-transparent hover:bg-gray-700'
                }`}
              >{l}</button>
            ))}
          </div>
          <button type="button" onClick={resetFit}
            className="ml-auto text-[10px] px-2.5 py-1 bg-gray-800 text-gray-400 hover:text-gray-200 rounded-lg border border-gray-700 transition-colors"
          >↺ リセット</button>
        </div>
      )}

      {/* Adj sliders */}
      {ready && (
        <div className="flex gap-4">
          <AdjPanel label="証跡（現場）" color="text-[#6dd39b]" adj={evAdj} onChange={setEvAdj} />
          <div className="w-px bg-gray-700/60 shrink-0" />
          <AdjPanel label="参考（異物）" color="text-red-400" adj={refAdj} onChange={setRefAdj} />
        </div>
      )}

      {/* Threshold + score bar */}
      {ready && (
        <div className="bg-gray-800/60 rounded-xl px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 shrink-0 w-16">エッジ感度</span>
            <input type="range" min={30} max={200} step={5} value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="flex-1 h-0.5 accent-teal-400 cursor-pointer"
            />
            <span className="text-[9px] text-gray-400 w-8 text-right tabular-nums">{threshold}</span>
          </div>
          {score !== null && (
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] text-gray-500 shrink-0 w-16">輪郭一致度</span>
                <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: scoreBarBg }} />
                </div>
                <span className={`text-xs font-bold tabular-nums font-mono w-10 text-right ${scoreColor}`}>{score}%</span>
              </div>
              <p className="text-[9px] text-gray-600">※目視照合支援の参考値。法的証拠能力・科学的同定能力はありません。</p>
            </div>
          )}
        </div>
      )}

      {/* RGB comparison */}
      <div className="bg-gray-800/60 rounded-xl px-3 py-2 space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 font-mono">RGB / 輝度 比較</p>
        {evPx || refPx ? (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-gray-600">
                {['対象', 'R', 'G', 'B', '輝度', 'HEX', ''].map(h => (
                  <th key={h} className={`font-normal pb-1 ${h === '対象' ? 'text-left pr-2' : 'text-right pr-1'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rgbRows.map(({ label, cls, px }) => (
                <tr key={label}>
                  <td className={`${cls} font-bold py-0.5 pr-2`}>{label}</td>
                  {px ? (
                    <>
                      {[px.r, px.g, px.b, px.lum].map((v, i) => (
                        <td key={i} className="text-right pr-1 text-gray-200">{v}</td>
                      ))}
                      <td className="text-right pr-1 text-gray-300 text-[9px]">{px.hex.toUpperCase()}</td>
                      <td><span className="w-3.5 h-3.5 rounded-sm inline-block border border-gray-600" style={{ background: px.hex }} /></td>
                    </>
                  ) : (
                    <td colSpan={6} className="text-gray-700 pr-1">—</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[10px] text-gray-600 py-1 text-center">キャンバスをクリックしてピクセルを選択</p>
        )}
      </div>

      {/* Note */}
      <textarea value={note} onChange={e => setNote(e.target.value)}
        placeholder="照合所見を入力（レポートPNGに出力）..."
        rows={2}
        className="w-full bg-gray-800 text-gray-200 text-xs rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-teal-600/50 resize-none placeholder:text-gray-600"
      />

      {/* Export */}
      <button type="button" onClick={exportPng} disabled={!ready}
        className="w-full py-2.5 text-xs font-bold text-gray-900 bg-[#6dd39b] rounded-xl hover:bg-[#5bc489] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        📋 照合レポートPNGを出力
      </button>
    </div>
  )
}
