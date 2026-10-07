'use client'

import { useEffect } from 'react'

/**
 * グローバルなキーボード対策コンポーネント。
 * - input/textarea にフォーカスしたとき、300ms 後に scrollIntoView でキーボード上に見える位置へ移動
 * - visualViewport の resize を監視し、キーボード表示中は body に data-kb 属性を付与
 *   (Navigation.tsx がこの属性を見て自身を非表示にする)
 */
export default function KeyboardSafe() {
  useEffect(() => {
    // フォーカス時スクロール
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 300)
    }
    document.addEventListener('focusin', onFocus, true)

    // visualViewport でキーボード検出
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return () => document.removeEventListener('focusin', onFocus, true)

    const onViewportResize = () => {
      const ratio = vv.height / window.innerHeight
      if (ratio < 0.75) {
        document.body.setAttribute('data-kb', '1')
      } else {
        document.body.removeAttribute('data-kb')
      }
    }
    vv.addEventListener('resize', onViewportResize)

    return () => {
      document.removeEventListener('focusin', onFocus, true)
      vv.removeEventListener('resize', onViewportResize)
    }
  }, [])

  return null
}
