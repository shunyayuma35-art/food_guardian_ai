'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/demo-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(true)
        setPassword('')
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col gap-5"
      >
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-4xl font-extrabold text-orange-500 tracking-tight">FoodEye</p>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Demo</p>
          <p className="text-sm text-gray-500 pt-1">アクセスコードを入力してください</p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-1.5">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="アクセスコード"
            className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-colors ${
              error ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-800'
            }`}
            autoFocus
            autoComplete="current-password"
            disabled={loading}
          />
          {error && (
            <p className="text-xs text-red-500 pl-1">コードが違います。もう一度お試しください。</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '確認中…' : '入室する →'}
        </button>

        <p className="text-center text-[10px] text-gray-400">
          このシステムはデモ・試用版です
        </p>
      </form>
    </div>
  )
}
