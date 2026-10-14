'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** localStorage keys to clear when "reset draft" is tapped */
  resetKeys?: string[]
}
interface State { hasError: boolean; message: string }

function getLang(): 'ja' | 'en' {
  try { return (localStorage.getItem('foodeye_lang') ?? 'ja') === 'en' ? 'en' : 'ja' } catch { return 'ja' }
}

const BOUNDARY = {
  title:   { ja: '表示に失敗しました', en: 'Failed to display' },
  message: { ja: '予期しないエラーが発生しました', en: 'An unexpected error occurred' },
  reload:  { ja: '🔄 再読み込み', en: '🔄 Reload' },
  reset:   { ja: '🗑 下書きをリセットして再読み込み', en: '🗑 Reset draft & reload' },
} as const

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset() {
    try {
      const keys = this.props.resetKeys ?? []
      keys.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
    this.setState({ hasError: false, message: '' })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const lang = getLang()
      const tx = (k: keyof typeof BOUNDARY) => BOUNDARY[k][lang]
      const hasResetKeys = (this.props.resetKeys?.length ?? 0) > 0
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-orange-50">
          <div className="card max-w-sm w-full p-8 text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="font-extrabold text-gray-800 text-lg">{tx('title')}</h2>
            <p className="text-sm text-gray-500 leading-relaxed break-all">
              {this.state.message || tx('message')}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-2xl shadow-md shadow-orange-200 hover:bg-orange-600 transition-all"
            >
              {tx('reload')}
            </button>
            {hasResetKeys && (
              <button
                onClick={() => this.handleReset()}
                className="w-full py-2.5 bg-white text-red-500 border border-red-200 font-bold rounded-2xl hover:bg-red-50 transition-all text-sm"
              >
                {tx('reset')}
              </button>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
