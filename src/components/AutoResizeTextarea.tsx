'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
}

const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function AutoResizeTextarea({ value, className = '', style, ...rest }, forwardedRef) {
    const ref = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(forwardedRef, () => ref.current!)

    const resize = () => {
      const el = ref.current
      if (!el) return
      el.style.height = 'auto'
      const maxH = window.innerHeight * 0.6
      el.style.height = Math.min(el.scrollHeight, maxH) + 'px'
      el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
    }

    useEffect(() => {
      resize()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    return (
      <textarea
        ref={ref}
        value={value}
        className={`${className} resize-none`}
        style={{
          minHeight: '6rem', // ~4 rows
          lineHeight: 1.7,
          fontSize: '16px', // prevent iOS zoom
          ...style,
        }}
        onInput={resize}
        {...rest}
      />
    )
  }
)

export default AutoResizeTextarea
