'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

export default function PhotoLightbox({ src, alt, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTouch = useRef<{ x: number; y: number } | null>(null)
  const lastPinchDist = useRef<number | null>(null)
  const lastTapTime = useRef<number>(0)
  const dragging = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const clampOffset = useCallback((ox: number, oy: number, s: number) => {
    if (s <= 1) return { x: 0, y: 0 }
    const el = containerRef.current
    if (!el) return { x: ox, y: oy }
    const maxX = (el.clientWidth * (s - 1)) / 2
    const maxY = (el.clientHeight * (s - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }, [])

  function pinchDist(e: React.TouchEvent) {
    return Math.hypot(
      e.touches[1].clientX - e.touches[0].clientX,
      e.touches[1].clientY - e.touches[0].clientY,
    )
  }

  function pinchCenter(e: React.TouchEvent) {
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
    if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTapTime.current < 300) {
        // double-tap: toggle 3× zoom
        setScale(s => {
          const next = s < 1.5 ? 3 : 1
          setOffset({ x: 0, y: 0 })
          return next
        })
        lastTapTime.current = 0
        return
      }
      lastTapTime.current = now
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      dragging.current = false
      lastPinchDist.current = null
    } else if (e.touches.length === 2) {
      lastPinchDist.current = pinchDist(e)
      lastTouch.current = pinchCenter(e)
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.touches.length === 1 && scale > 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x
      const dy = e.touches[0].clientY - lastTouch.current.y
      setOffset(prev => clampOffset(prev.x + dx, prev.y + dy, scale))
      dragging.current = true
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      const dist = pinchDist(e)
      const center = pinchCenter(e)
      if (lastPinchDist.current !== null) {
        const ratio = dist / lastPinchDist.current
        setScale(prev => {
          const next = Math.max(1, Math.min(5, prev * ratio))
          if (next <= 1) setOffset({ x: 0, y: 0 })
          return next
        })
      }
      lastPinchDist.current = dist
      lastTouch.current = center
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 0) {
      lastTouch.current = null
      lastPinchDist.current = null
    }
  }

  const resetZoom = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)' }}
      onClick={() => { if (scale <= 1) onClose() }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full text-white text-lg font-bold"
        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
      >
        ✕
      </button>

      {/* Reset zoom */}
      {scale > 1 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); resetZoom() }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full text-white text-xs"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
        >
          元に戻す
        </button>
      )}

      {scale <= 1 && (
        <span className="absolute bottom-8 left-0 right-0 text-center text-[11px] pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          ピンチで拡大　ダブルタップで3倍
        </span>
      )}

      {/* Image */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ''}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transformOrigin: 'center center',
            transition: dragging.current ? 'none' : 'transform 0.18s ease',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
