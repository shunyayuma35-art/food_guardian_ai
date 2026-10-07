'use client'

import { useRef, useEffect, useState } from 'react'
import { formatLocalDate } from '@/lib/utils'

interface Marker { id: number; x: number; y: number }
interface PixelInfo { r: number; g: number; b: number; luminance: number; hex: string }
interface Props { imageDataUrl: string }

// Sobel edge detection: modifies `out` in-place (canvas pixel data), reads from `src` (original)
function sobel(src: Uint8ClampedArray, out: Uint8ClampedArray, w: number, h: number) {
  const GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const GY = [-1, -2, -1,  0, 0, 0,  1, 2, 1]
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = src[i*4]*.3 + src[i*4+1]*.59 + src[i*4+2]*.11
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const k = (ky+1)*3+(kx+1), v = g[(y+ky)*w+(x+kx)]
          gx += v * GX[k]; gy += v * GY[k]
        }
      }
      if (Math.sqrt(gx*gx + gy*gy) > 90) {
        const p = (y*w+x)*4
        out[p]=55; out[p+1]=211; out[p+2]=155; out[p+3]=255
      }
    }
  }
}

const MAX_W = 680

export default function ForeignMatterVisualizer({ imageDataUrl }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef      = useRef<HTMLImageElement | null>(null)
  const rawRef      = useRef<ImageData | null>(null)
  const dragRef     = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const [managementId, setManagementId] = useState('')
  const [proc,         setProc]         = useState('')
  const [detectedAt,   setDetectedAt]   = useState(() => formatLocalDate())

  const [cw,       setCw]       = useState(0)
  const [ch,       setCh]       = useState(0)
  const [showEdge, setShowEdge] = useState(true)
  const [showGray, setShowGray] = useState(false)
  const [showGrid, setShowGrid] = useState(true)

  const [markers, setMarkers] = useState<Marker[]>([])
  const [selId,   setSelId]   = useState<number | null>(null)
  const [info,    setInfo]    = useState<PixelInfo | null>(null)

  // ── Image load + auto-detect markers ──────────────────────────────────────
  useEffect(() => {
    setSelId(null)
    setInfo(null)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const dw = Math.min(img.naturalWidth, MAX_W)
      const dh = Math.round(img.naturalHeight * dw / img.naturalWidth)

      const oc = document.createElement('canvas')
      oc.width = dw; oc.height = dh
      const ctx = oc.getContext('2d')!
      ctx.drawImage(img, 0, 0, dw, dh)
      rawRef.current = ctx.getImageData(0, 0, dw, dh)
      setCw(dw); setCh(dh)

      // Auto-detect high-contrast points
      const { data } = rawRef.current
      const step = Math.max(4, Math.round(Math.min(dw, dh) / 40))
      const lum  = (i: number) => data[i]*.3 + data[i+1]*.59 + data[i+2]*.11
      const cands: { x: number; y: number; s: number }[] = []

      for (let y = step; y < dh - step; y += step) {
        for (let x = step; x < dw - step; x += step) {
          const cv = lum((y*dw+x)*4)
          let s = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue
              s += Math.abs(cv - lum(((y+dy*step)*dw+(x+dx*step))*4))
            }
          cands.push({ x, y, s })
        }
      }
      cands.sort((a, b) => b.s - a.s)

      const minDist = Math.min(dw, dh) / 5
      const sel: typeof cands = []
      for (const c of cands) {
        if (sel.length >= 5) break
        if (!sel.some(s => Math.hypot(c.x-s.x, c.y-s.y) < minDist)) sel.push(c)
      }
      setMarkers(sel.map((s, i) => ({ id: i+1, x: s.x, y: s.y })))
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // ── Canvas render ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || cw === 0) return
    canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d')!

    ctx.filter = showGray ? 'grayscale(1) contrast(1.15)' : 'none'
    ctx.drawImage(img, 0, 0, cw, ch)
    ctx.filter = 'none'

    if (showEdge && rawRef.current) {
      const ed = ctx.getImageData(0, 0, cw, ch)
      sobel(rawRef.current.data, ed.data, cw, ch)
      ctx.putImageData(ed, 0, 0)
    }

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(cw/2, 0);  ctx.lineTo(cw/2, ch)
      ctx.moveTo(0, ch/2);  ctx.lineTo(cw, ch/2)
      ctx.stroke()
    }
  }, [cw, ch, showEdge, showGray, showGrid])

  // ── Pixel info for selected marker ────────────────────────────────────────
  useEffect(() => {
    if (selId === null || !rawRef.current) { setInfo(null); return }
    const m = markers.find(m => m.id === selId)
    if (!m) { setInfo(null); return }
    const { data, width } = rawRef.current
    const i = (Math.round(m.y) * width + Math.round(m.x)) * 4
    const [r, g, b] = [data[i], data[i+1], data[i+2]]
    const luminance  = Math.round(r*.3 + g*.59 + b*.11)
    const hex        = `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`
    setInfo({ r, g, b, luminance, hex })
  }, [selId, markers])

  // ── Drag ──────────────────────────────────────────────────────────────────
  function onMarkerDown(e: React.MouseEvent, id: number) {
    e.preventDefault(); e.stopPropagation()
    setSelId(id)
    const m = markers.find(m => m.id === id)!
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: m.x, oy: m.y }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const r   = containerRef.current.getBoundingClientRect()
      const nx  = Math.max(0, Math.min(cw-1, dragRef.current.ox + (ev.clientX-dragRef.current.sx) / (r.width/cw)))
      const ny  = Math.max(0, Math.min(ch-1, dragRef.current.oy + (ev.clientY-dragRef.current.sy) / (r.height/ch)))
      setMarkers(prev => prev.map(m => m.id === dragRef.current!.id ? { ...m, x: nx, y: ny } : m))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function addMarker() {
    const id = markers.length ? Math.max(...markers.map(m => m.id)) + 1 : 1
    setMarkers(prev => [...prev, { id, x: cw/2, y: ch/2 }])
    setSelId(id)
  }
  function delSelected() {
    if (selId === null) return
    setMarkers(p => p.filter(m => m.id !== selId))
    setSelId(null)
  }

  // ── Export PNG ────────────────────────────────────────────────────────────
  function exportPng() {
    const img = imgRef.current
    if (!img || !rawRef.current || cw === 0) return
    const HDR = 54
    const oc = document.createElement('canvas')
    oc.width = cw; oc.height = ch + HDR
    const ctx = oc.getContext('2d')!

    // Header band
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, cw, HDR)
    ctx.fillStyle = '#6dd39b'; ctx.font = 'bold 13px monospace'
    ctx.fillText(`管理番号: ${managementId || '---'}`, 10, 20)
    ctx.fillStyle = '#888'; ctx.font = '11px monospace'
    ctx.fillText(`工程/ロット: ${proc || '---'}  |  検出日: ${detectedAt}`, 10, 40)

    // Image
    ctx.filter = showGray ? 'grayscale(1) contrast(1.15)' : 'none'
    ctx.drawImage(img, 0, HDR, cw, ch)
    ctx.filter = 'none'

    if (showEdge) {
      const ed = ctx.getImageData(0, HDR, cw, ch)
      sobel(rawRef.current.data, ed.data, cw, ch)
      ctx.putImageData(ed, 0, HDR)
    }
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cw/2, HDR); ctx.lineTo(cw/2, HDR+ch)
      ctx.moveTo(0, HDR+ch/2); ctx.lineTo(cw, HDR+ch/2)
      ctx.stroke()
    }

    // Burn-in markers
    markers.forEach(m => {
      const px = m.x, py = m.y + HDR
      ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI*2)
      ctx.fillStyle   = m.id === selId ? '#ef4444' : '#22c55e'; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle   = '#fff'; ctx.font = 'bold 11px sans-serif'
      ctx.textAlign   = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(m.id), px, py)
    })

    const a = document.createElement('a')
    a.href = oc.toDataURL('image/png')
    a.download = `forensic_${managementId || 'img'}_${detectedAt}.png`
    a.click()
  }

  // ── Display option helpers ────────────────────────────────────────────────
  const displayOpts = [
    { label: '輪郭', on: showEdge, toggle: () => setShowEdge(v => !v) },
    { label: 'グレー', on: showGray, toggle: () => setShowGray(v => !v) },
    { label: 'グリッド', on: showGrid, toggle: () => setShowGrid(v => !v) },
  ]
  const pixelRows = info ? [
    { k: 'R',  v: info.r,         cls: 'text-red-400'   },
    { k: 'G',  v: info.g,         cls: 'text-green-400' },
    { k: 'B',  v: info.b,         cls: 'text-blue-400'  },
    { k: '輝度', v: info.luminance, cls: 'text-gray-200'  },
  ] : []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 text-gray-100 overflow-hidden text-xs font-mono">

      {/* Info bar */}
      <div className="bg-gray-950 border-b border-gray-700 px-3 py-2 grid grid-cols-3 gap-2">
        {[
          { label: '異物管理番号', val: managementId, set: setManagementId, placeholder: 'E-001', accent: true },
          { label: '発見工程・ロット', val: proc, set: setProc, placeholder: '充填工程 / L240728', accent: false },
        ].map(({ label, val, set, placeholder, accent }) => (
          <div key={label}>
            <div className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">{label}</div>
            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
              className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full text-xs focus:outline-none focus:border-gray-500 ${accent ? 'text-[#6dd39b] focus:border-[#6dd39b]' : 'text-gray-200'}`} />
          </div>
        ))}
        <div>
          <div className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">検出日</div>
          <input type="date" value={detectedAt} onChange={e => setDetectedAt(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 w-full text-xs focus:outline-none focus:border-gray-500" />
        </div>
      </div>

      {/* Canvas + Analysis panel */}
      <div className="flex flex-col sm:flex-row">

        {/* Canvas area */}
        <div className="flex-1 relative bg-black min-h-[140px]" ref={containerRef}>
          {cw === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-[#6dd39b] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas ref={canvasRef} className="w-full block"
            style={{ aspectRatio: cw > 0 ? `${cw}/${ch}` : 'auto' }} />

          {/* Draggable markers (% positioning relative to canvas container) */}
          {cw > 0 && markers.map(m => (
            <div
              key={m.id}
              onMouseDown={e => onMarkerDown(e, m.id)}
              style={{ position: 'absolute', left: `${(m.x/cw)*100}%`, top: `${(m.y/ch)*100}%`, transform: 'translate(-50%,-50%)' }}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                cursor-grab active:cursor-grabbing select-none z-10
                ${m.id === selId
                  ? 'bg-red-500 ring-2 ring-white shadow-lg shadow-red-500/50'
                  : 'bg-green-500 ring-1 ring-white/80 shadow-md shadow-green-500/40'
                }`}
            >
              {m.id}
            </div>
          ))}
        </div>

        {/* Analysis panel */}
        <div className="sm:w-40 bg-gray-950 border-t sm:border-t-0 sm:border-l border-gray-700 p-3 space-y-3 shrink-0">

          {/* Pixel info */}
          <div>
            <div className="text-[#6dd39b] text-[8px] uppercase tracking-widest mb-1.5 font-bold">
              解析対象{selId !== null ? ` #${selId}` : ''}
            </div>
            {info ? (
              <>
                <table className="w-full border-collapse">
                  <tbody>
                    {pixelRows.map(({ k, v, cls }) => (
                      <tr key={k} className="border-b border-gray-800">
                        <td className="text-gray-500 py-0.5 pr-2 text-[10px]">{k}</td>
                        <td className={`py-0.5 font-bold tabular-nums text-[10px] ${cls}`}>{v}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-800">
                      <td className="text-gray-500 py-0.5 pr-2 text-[10px]">HEX</td>
                      <td className="text-gray-300 py-0.5 text-[10px]">{info.hex}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="w-full h-7 rounded mt-2 border border-gray-700"
                  style={{ backgroundColor: info.hex }} />
              </>
            ) : (
              <p className="text-gray-600 text-[9px] leading-relaxed">
                マーカーを<br />選択してください
              </p>
            )}
          </div>

          <hr className="border-gray-800" />

          {/* Display toggles */}
          <div className="space-y-1">
            <div className="text-gray-600 text-[8px] uppercase tracking-widest">表示</div>
            {displayOpts.map(({ label, on, toggle }) => (
              <button key={label} onClick={toggle}
                className={`w-full py-0.5 text-[9px] rounded border transition-all
                  ${on
                    ? 'bg-[#6dd39b]/15 border-[#6dd39b]/60 text-[#6dd39b]'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}>
                {on ? '▣' : '□'} {label}
              </button>
            ))}
          </div>

          <hr className="border-gray-800" />

          {/* Marker controls */}
          <div className="space-y-1">
            <div className="text-gray-600 text-[8px] uppercase tracking-widest">マーカー</div>
            <button onClick={addMarker}
              className="w-full py-0.5 text-[9px] rounded border bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 transition-all">
              ＋ 追加
            </button>
            <button onClick={delSelected} disabled={selId === null}
              className="w-full py-0.5 text-[9px] rounded border bg-gray-800 border-gray-700 text-red-400 hover:border-red-700 transition-all disabled:opacity-30">
              選択を削除
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-950 border-t border-gray-700 px-3 py-2 flex items-center justify-between">
        <span className="text-[8px] text-gray-600">FoodEye Forensic • マーカーはドラッグで移動</span>
        <button onClick={exportPng}
          className="px-3 py-1.5 bg-[#6dd39b] text-gray-900 text-[10px] font-bold rounded hover:bg-[#4dcb85] active:scale-95 transition-all">
          📄 報告書用PNG
        </button>
      </div>
    </div>
  )
}
