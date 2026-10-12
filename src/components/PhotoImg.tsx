'use client'

import { useState, useEffect } from 'react'
import { resolvePhotoRef } from '@/lib/photo-store'

interface Props {
  src: string | null | undefined
  alt?: string
  className?: string
  placeholder?: string
}

export default function PhotoImg({ src, alt = '', className = '', placeholder = '🔍' }: Props) {
  const [resolved, setResolved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src) { setResolved(null); setFailed(false); return }
    setFailed(false)
    setResolved(null)
    let cancelled = false
    resolvePhotoRef(src).then(url => {
      if (!cancelled) {
        setResolved(url)
        if (url === null) setFailed(true)
      }
    }).catch(() => {
      if (!cancelled) { setResolved(null); setFailed(true) }
    })
    return () => { cancelled = true }
  }, [src])

  if (!resolved) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-orange-50 ${className}`}>
        <span className="text-2xl">{placeholder}</span>
        {failed && src && (
          <span className="text-[10px] text-gray-400 text-center leading-tight px-1">
            この端末では<br />写真を表示できません
          </span>
        )}
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => { setFailed(true); setResolved(null) }}
    />
  )
}
