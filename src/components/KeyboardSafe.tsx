'use client'

import { useEffect } from 'react'

/**
 * グローバルなキーボード対策コンポーネント。
 * - input/textarea に「初めて」フォーカスしたとき、かつ画面外のときだけ scrollIntoView
 *   (入力中の再フォーカスや既に見えている要素ではスクロールしない)
 * - visualViewport の resize を監視し、キーボード表示中は body に data-kb 属性を付与
 *   (Navigation.tsx がこの属性を見て自身を非表示にする)
 */
export default function KeyboardSafe() {
  useEffect(() => {
    let lastFocused: Element | null = null

    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return
      // 同じ要素への再フォーカス（入力中のリフォーカスなど）は無視
      if (el === lastFocused) return
      lastFocused = el
      setTimeout(() => {
        // フォーカスが既に別の要素に移っていたら何もしない
        if (document.activeElement !== el) return
        const vv = window.visualViewport
        const rect = el.getBoundingClientRect()
        const viewTop = vv ? vv.offsetTop : 0
        const viewH = vv ? vv.height : window.innerHeight
        // 要素が十分に画面内に収まっていればスクロール不要
        if (rect.top >= viewTop + 40 && rect.bottom <= viewTop + viewH - 80) return
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 300)
    }

    const onBlur = (e: FocusEvent) => {
      if (e.target === lastFocused) lastFocused = null
    }

    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('focusout', onBlur, true)

    // visualViewport でキーボード検出
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return () => {
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('focusout', onBlur, true)
    }

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
      document.removeEventListener('focusout', onBlur, true)
      vv.removeEventListener('resize', onViewportResize)
    }
  }, [])

  return null
}
