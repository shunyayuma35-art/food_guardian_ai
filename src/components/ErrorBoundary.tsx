'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

function getLang(): 'ja' | 'en' {
  try { return (localStorage.getItem('lang') ?? 'ja') === 'en' ? 'en' : 'ja' } catch { return 'ja' }
}

const BOUNDARY = {
  title:   { ja: 'エラーが発生しました', en: 'An error occurred' },
  message: { ja: '予期しないエラーが発生しました', en: 'An unexpected error occurred' },
  reload:  { ja: '🔄 再読み込み', en: '🔄 Reload' },
} as const

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : ''
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      const lang = getLang()
      const tx = (k: keyof typeof BOUNDARY) => BOUNDARY[k][lang]
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-orange-50">
          <div className="card max-w-sm w-full p-8 text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="font-extrabold text-gray-800 text-lg">{tx('title')}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {this.state.message || tx('message')}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' })
                window.location.reload()
              }}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-2xl shadow-md shadow-orange-200 hover:bg-orange-600 transition-all"
            >
              {tx('reload')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
