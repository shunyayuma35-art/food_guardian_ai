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

  useEffect(() => {
    if (!src) { setResolved(null); return }
    let cancelled = false
    resolvePhotoRef(src).then(url => {
      if (!cancelled) setResolved(url)
    }).catch(() => {
      if (!cancelled) setResolved(null)
    })
    return () => { cancelled = true }
  }, [src])

  if (!resolved) {
    return (
      <div className={`flex items-center justify-center text-2xl bg-orange-50 ${className}`}>
        {placeholder}
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} className={className} />
}
