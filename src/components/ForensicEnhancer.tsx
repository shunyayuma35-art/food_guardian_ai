'use client'

import { useState, useEffect } from 'react'

interface Props {
  file?: File | null
  dataUrl?: string | null
}

interface AiForensicResult {
  name: string
  category: string
  confidence: string
  urgency: 'high' | 'medium' | 'low'
  size_estimate?: string
  color?: string[]
  shape?: string[]
  surface?: string[]
  touch?: string[]
  magnet?: string
  route?: string[]
  action?: string
}

// ── Canvas DSP helpers ────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function gaussianBlur(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const K = [1, 2, 1, 2, 4, 2, 1, 2, 1]
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, ws = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ny = Math.max(0, Math.min(h - 1, y + ky))
          const nx = Math.max(0, Math.min(w - 1, x + kx))
          const si = (ny * w + nx) * 4
          const kw = K[(ky + 1) * 3 + (kx + 1)]
          r += src[si] * kw; g += src[si + 1] * kw; b += src[si + 2] * kw
          ws += kw
        }
      }
      const oi = (y * w + x) * 4
      out[oi] = r / ws; out[oi + 1] = g / ws; out[oi + 2] = b / ws; out[oi + 3] = src[oi + 3]
    }
  }
  return out
}

function histEq(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const n = w * h
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    hist[Math.round(src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114)]++
  }
  const cdf = new Uint32Array(256)
  cdf[0] = hist[0]
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i]
  let cdfMin = 0
  for (let i = 0; i < 256; i++) { if (cdf[i] > 0) { cdfMin = cdf[i]; break } }
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = n > cdfMin ? Math.round((cdf[i] - cdfMin) / (n - cdfMin) * 255) : 0
  }
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < n; i++) {
    const ri = i * 4
    const lum = Math.round(src[ri] * 0.299 + src[ri + 1] * 0.587 + src[ri + 2] * 0.114)
    const scale = lum > 0 ? lut[lum] / lum : 1
    out[ri]     = Math.min(255, Math.round(src[ri]     * scale))
    out[ri + 1] = Math.min(255, Math.round(src[ri + 1] * scale))
    out[ri + 2] = Math.min(255, Math.round(src[ri + 2] * scale))
    out[ri + 3] = src[ri + 3]
  }
  return out
}

function sobelMag(src: Uint8ClampedArray, w: number, h: number): Float32Array {
  const GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const GY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const si = ((y + ky) * w + (x + kx)) * 4
          const lum = src[si] * 0.299 + src[si + 1] * 0.587 + src[si + 2] * 0.114
          const k = (ky + 1) * 3 + (kx + 1)
          gx += lum * GX[k]; gy += lum * GY[k]
        }
      }
      mag[y * w + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return mag
}

// Sobel visualization: bright white edges on dark background (forensic style)
function sobelVis(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const mag = sobelMag(src, w, h)
  let maxMag = 0
  for (let i = 0; i < mag.length; i++) if (mag[i] > maxMag) maxMag = mag[i]
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const v = maxMag > 0 ? Math.min(255, Math.round(Math.pow(mag[i] / maxMag, 0.4) * 255)) : 0
    // Cyan tint: forensic scanner look
    out[i * 4]     = 0
    out[i * 4 + 1] = Math.min(255, Math.round(v * 0.9))
    out[i * 4 + 2] = v
    out[i * 4 + 3] = 255
  }
  return out
}

// Red edge overlay on original image
function overlayEdges(orig: Uint8ClampedArray, mag: Float32Array, w: number, h: number, thr: number): Uint8ClampedArray {
  let maxMag = 0
  for (let i = 0; i < mag.length; i++) if (mag[i] > maxMag) maxMag = mag[i]
  const out = new Uint8ClampedArray(orig.length)
  for (let i = 0; i < orig.length; i++) out[i] = orig[i]
  if (maxMag <= thr) return out
  const range = maxMag - thr
  for (let i = 0; i < w * h; i++) {
    if (mag[i] <= thr) continue
    const t = Math.min(1, (mag[i] - thr) / range)
    const ri = i * 4
    const r = orig[ri], g = orig[ri + 1], b = orig[ri + 2]
    out[ri]     = Math.round(r + (255 - r) * t * 0.95)
    out[ri + 1] = Math.round(g * (1 - t * 0.92))
    out[ri + 2] = Math.round(b * (1 - t * 0.92))
  }
  return out
}

// ── Layer definitions ─────────────────────────────────────────────────────────

const LAYERS = [
  { title: 'LAYER 1', label: '元画像',          icon: '📷', color: '#9ca3af', desc: 'オリジナル' },
  { title: 'LAYER 2', label: 'ノイズ除去',       icon: '🌊', color: '#60a5fa', desc: 'ガウシアンフィルタ' },
  { title: 'LAYER 3', label: 'コントラスト強調', icon: '☀️', color: '#fbbf24', desc: 'ヒストグラム平坦化' },
  { title: 'LAYER 4', label: 'エッジ検出',       icon: '🔍', color: '#34d399', desc: 'Sobelフィルタ（サイアン）' },
  { title: 'LAYER 5', label: '異物ハイライト',   icon: '🔴', color: '#f87171', desc: '赤色オーバーレイ' },
]

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1400
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18)
    setTimeout(() => ctx.close(), 400)
  } catch { /* ignore – AudioContext not available */ }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ForensicEnhancer({ file, dataUrl }: Props) {
  const [srcUrl, setSrcUrl]       = useState<string | null>(null)
  const [layerUrls, setLayerUrls] = useState<string[]>([])
  const [aiReadyUrl, setAiReadyUrl] = useState<string | null>(null)
  const [layerIdx, setLayerIdx]   = useState(0)
  const [fading, setFading]       = useState(false)
  const [computing, setComputing] = useState(false)
  const [open, setOpen]           = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult]   = useState<AiForensicResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [userHint, setUserHint]   = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)

  // File → data URL
  useEffect(() => {
    if (dataUrl) { setSrcUrl(dataUrl); return }
    if (!file) { setSrcUrl(null); return }
    const reader = new FileReader()
    reader.onload = e => setSrcUrl(e.target?.result as string ?? null)
    reader.readAsDataURL(file)
  }, [file, dataUrl])

  // Compute all 5 layers
  useEffect(() => {
    if (!srcUrl) { setLayerUrls([]); setLayerIdx(0); setAiResult(null); return }
    let cancelled = false
    ;(async () => {
      setComputing(true)
      setLayerIdx(0)
      setAiResult(null)
      setShowResult(false)
      try {
        const img = await loadImg(srcUrl)
        const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)

        const make = () => {
          const oc = document.createElement('canvas')
          oc.width = w; oc.height = h
          return oc
        }
        const url = (oc: HTMLCanvasElement) => oc.toDataURL('image/jpeg', 0.92)

        // Layer 1 – original
        const oc1 = make()
        const ctx1 = oc1.getContext('2d')!
        ctx1.fillStyle = '#ffffff'; ctx1.fillRect(0, 0, w, h)
        ctx1.drawImage(img, 0, 0, w, h)
        const raw = ctx1.getImageData(0, 0, w, h).data

        // Layer 2 – Gaussian blur
        const blurred = gaussianBlur(raw, w, h)
        const oc2 = make()
        const ctx2 = oc2.getContext('2d')!
        ctx2.putImageData(new ImageData(blurred.slice() as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)

        // Layer 3 – Histogram equalization
        const equalized = histEq(blurred, w, h)
        const oc3 = make()
        const ctx3 = oc3.getContext('2d')!
        ctx3.putImageData(new ImageData(equalized.slice() as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)

        // Layer 4 – Sobel cyan visualization
        const sobelPixels = sobelVis(equalized, w, h)
        const oc4 = make()
        const ctx4 = oc4.getContext('2d')!
        ctx4.putImageData(new ImageData(sobelPixels.slice() as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)

        // Layer 5 – Red overlay on original
        const mag = sobelMag(equalized, w, h)
        const visual = overlayEdges(raw, mag, w, h, 40)
        const oc5 = make()
        const ctx5 = oc5.getContext('2d')!
        ctx5.putImageData(new ImageData(visual.slice() as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)

        if (cancelled) return
        setLayerUrls([url(oc1), url(oc2), url(oc3), url(oc4), url(oc5)])
        setAiReadyUrl(url(oc3)) // equalized image for AI analysis
      } catch (e) {
        console.error('[ForensicEnhancer]', e)
      } finally {
        if (!cancelled) setComputing(false)
      }
    })()
    return () => { cancelled = true }
  }, [srcUrl])

  function goToLayer(next: number) {
    if (next < 0 || next >= LAYERS.length) return
    setFading(true)
    setTimeout(() => { setLayerIdx(next); setFading(false) }, 220)
  }

  function advance() {
    const next = layerIdx + 1
    if (next >= LAYERS.length) return
    setFading(true)
    setTimeout(() => {
      setLayerIdx(next)
      setFading(false)
      if (next === LAYERS.length - 1) {
        playBeep()
        runAI()
      }
    }, 220)
  }

  async function runAI() {
    if (!aiReadyUrl) return
    setAnalyzing(true)
    setShowResult(false)
    try {
      const res = await fetch('/api/analyze-foreign-matter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: aiReadyUrl.split(',')[1],
          mediaType: 'image/jpeg',
          structured: true,
          userHint: userHint.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setAiResult({ name: '上限超過', category: '', confidence: '', urgency: 'low',
          action: '今月の無料解析上限（3回）に達しました。@hapifoodlab までご連絡ください。' })
        setShowResult(true)
        return
      }
      if (data.quickResult) {
        setAiResult(data.quickResult as AiForensicResult)
        setShowResult(true)
        if (data.remaining != null) setRemaining(data.remaining)
      }
    } catch {
      setAiResult({ name: 'エラー', category: '', confidence: '', urgency: 'low',
        action: 'ネットワークエラーが発生しました。' })
      setShowResult(true)
    } finally {
      setAnalyzing(false)
    }
  }

  if (!srcUrl) return null

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full py-2 text-xs font-semibold text-purple-700 border border-purple-200 bg-purple-50 rounded-xl hover:bg-purple-100 active:scale-95 transition-all">
        🔬 鑑識レイヤー解析を開く（ハッカソン版 AI精度向上）
      </button>
    )
  }

  const layer = LAYERS[layerIdx]
  const isLast = layerIdx === LAYERS.length - 1
  const imgSrc = layerUrls[layerIdx] ?? srcUrl

  const urgencyStyle = {
    high:   { glow: '#ef4444', badge: 'bg-red-600',   label: '🔴 高' },
    medium: { glow: '#f59e0b', badge: 'bg-amber-600', label: '🟡 中' },
    low:    { glow: '#22c55e', badge: 'bg-green-600', label: '🟢 低' },
  }
  const ust = aiResult ? (urgencyStyle[aiResult.urgency] ?? urgencyStyle.low) : null

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d0d0f', border: '1px solid #2d2d35' }}>
      <style>{`
        @keyframes fe-scan {
          0%   { top: -2px; opacity: 0.9; }
          50%  { opacity: 0.6; }
          100% { top: calc(100% + 2px); opacity: 0.9; }
        }
        @keyframes fe-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fe-pulse-ring {
          0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>

      {/* Header bar */}
      <div style={{ background: '#111116', borderBottom: '1px solid #2d2d35' }}
        className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-sm">🔬</span>
          <span className="text-xs font-bold text-gray-200">鑑識レイヤー解析</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: '#1e1b4b', color: '#a78bfa' }}>FORENSIC MODE</span>
        </div>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">✕</button>
      </div>

      {/* ── Image viewer ── */}
      <div className="relative" style={{ aspectRatio: '4/3', background: '#000', overflow: 'hidden' }}>
        {computing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
            <span className="text-xs font-mono text-gray-500">PROCESSING...</span>
          </div>
        ) : (
          <>
            {/* Main image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={layer.label}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.22s ease', filter: layerIdx === 3 ? 'brightness(1.3)' : 'none' }}
            />

            {/* Scanning animation */}
            {analyzing && (
              <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: '3px',
                  background: 'linear-gradient(90deg, transparent, #ef4444, #ff6b6b, #ef4444, transparent)',
                  animation: 'fe-scan 1.2s linear infinite',
                  boxShadow: '0 0 12px #ef4444',
                }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.06)' }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-sm font-bold font-mono animate-pulse" style={{ color: '#ef4444' }}>
                    🔬 SCANNING...
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: '#6b7280' }}>
                    ANALYZING FOREIGN MATTER
                  </span>
                </div>
              </div>
            )}

            {/* Layer label */}
            {!analyzing && !showResult && (
              <div className="absolute top-2 left-2"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', borderRadius: '8px', padding: '6px 10px' }}>
                <p className="text-[9px] font-mono mb-0.5" style={{ color: '#6b7280' }}>{layer.title}</p>
                <p className="text-xs font-bold" style={{ color: layer.color }}>{layer.icon} {layer.label}</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#4b5563' }}>{layer.desc}</p>
              </div>
            )}

            {/* Layer progress dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              {LAYERS.map((l, i) => (
                <button key={i} type="button" onClick={() => goToLayer(i)}
                  className="transition-all rounded-full"
                  style={{
                    width: i === layerIdx ? '20px' : '6px',
                    height: '6px',
                    background: i < layerIdx ? l.color : i === layerIdx ? l.color : '#374151',
                    opacity: i < layerIdx ? 0.6 : 1,
                  }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── AI Result popup ── */}
      {showResult && aiResult && ust && (
        <div style={{ background: '#0f0c0c', animation: 'fe-slide-up 0.35s ease-out',
          borderTop: `1px solid ${ust.glow}40` }} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: '#6b7280' }}>
              FORENSIC RESULT
            </span>
            <div className="flex items-center gap-2">
              {remaining != null && (
                <span className="text-[9px]" style={{ color: '#6b7280' }}>残り{remaining}回</span>
              )}
              <button type="button" onClick={() => setShowResult(false)}
                className="text-[10px]" style={{ color: '#4b5563' }}>✕</button>
            </div>
          </div>

          {/* Name + badges */}
          <div>
            <p className="text-2xl font-extrabold leading-tight" style={{ color: '#ffffff' }}>
              🔴 {aiResult.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {aiResult.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>
                  {aiResult.category}
                </span>
              )}
              {aiResult.confidence && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${ust.badge}`}>
                  信頼度：{aiResult.confidence}
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${ust.badge}`}>
                緊急度 {ust.label}
              </span>
            </div>
          </div>

          {/* Size + magnet */}
          {(aiResult.size_estimate || aiResult.magnet) && (
            <div className="flex gap-2">
              {aiResult.size_estimate && (
                <span className="text-xs rounded-lg px-3 py-1.5 flex-1"
                  style={{ background: '#1f2937', color: '#d1d5db' }}>
                  📏 {aiResult.size_estimate}
                </span>
              )}
              {aiResult.magnet && aiResult.magnet !== '不明' && (
                <span className="text-xs rounded-lg px-3 py-1.5 flex-1"
                  style={{ background: '#1f2937', color: '#d1d5db' }}>
                  🧲 {aiResult.magnet}
                </span>
              )}
            </div>
          )}

          {/* Routes */}
          {aiResult.route && aiResult.route.length > 0 && (
            <div>
              <p className="text-[9px] font-mono mb-1.5" style={{ color: '#6b7280' }}>推定混入経路</p>
              <div className="flex flex-wrap gap-1">
                {aiResult.route.map((r, i) => (
                  <span key={i} className="text-[10px] rounded px-2 py-0.5"
                    style={{ background: '#1e293b', color: '#94a3b8' }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          {aiResult.action && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: '#1a1a2e', border: `1px solid ${ust.glow}30` }}>
              <p className="text-[9px] font-mono mb-1" style={{ color: '#6b7280' }}>推奨対応</p>
              <p className="text-xs font-medium" style={{ color: '#e2e8f0' }}>{aiResult.action}</p>
            </div>
          )}

          <p className="text-[9px] text-center" style={{ color: '#4b5563' }}>
            ⚠️ 確定診断には外部専門機関の鑑定が必要です
          </p>
        </div>
      )}

      {/* ── Controls ── */}
      {!computing && layerUrls.length > 0 && (
        <div style={{ background: '#111116', borderTop: '1px solid #2d2d35' }} className="px-4 py-3 space-y-2.5">
          {/* Hint input */}
          <input
            type="text"
            value={userHint}
            onChange={e => setUserHint(e.target.value)}
            placeholder="💡 異物の心当たり（任意）例：赤いパレット片"
            className="w-full text-xs px-3 py-2 rounded-xl focus:outline-none"
            style={{ background: '#1c1c24', border: '1px solid #2d2d35', color: '#d1d5db' }}
          />

          {/* Layer nav buttons */}
          <div className="flex gap-2">
            {layerIdx > 0 && (
              <button type="button" onClick={() => goToLayer(layerIdx - 1)}
                className="flex-none py-2 px-3 text-xs rounded-xl transition-all"
                style={{ background: '#1c1c24', border: '1px solid #2d2d35', color: '#6b7280' }}>
                ◀
              </button>
            )}
            {!isLast ? (
              <button type="button" onClick={advance} disabled={fading || computing}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95"
                style={{ background: '#4c1d95', color: '#fff' }}>
                次のレイヤー ▶　{LAYERS[layerIdx + 1]?.icon} {LAYERS[layerIdx + 1]?.label}
              </button>
            ) : (
              <button type="button" onClick={runAI} disabled={analyzing}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95"
                style={{
                  background: analyzing ? '#4b5563' : '#7f1d1d',
                  color: '#fff',
                  animation: !analyzing ? 'fe-pulse-ring 2s infinite' : 'none',
                }}>
                {analyzing ? '🔬 解析中...' : '🤖 AI再解析'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
