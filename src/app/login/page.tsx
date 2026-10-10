'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import { DEMO_MODE } from '@/lib/firebase'
import FoodEyeLogo from '@/components/FoodEyeLogo'
import LanguageSelector from '@/components/LanguageSelector'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { user, loading, login, signup } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  // デモモード: 認証情報を一切画面に出さずワンタップでログイン
  async function handleDemoLogin() {
    setSubmitting(true)
    try {
      await login('user@foodeye.local', 'foodeye2024')
      toast.success(t('toast.unlocked'))
      router.replace('/')
    } catch {
      toast.error(t('toast.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error(t('toast.enterEmailPass'))
      return
    }
    setSubmitting(true)
    try {
      if (isSignup) {
        await signup(email, password)
        toast.success(t('toast.accountCreated'))
      } else {
        await login(email, password)
        toast.success(t('toast.loggedIn'))
      }
      router.replace('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('wrong-password') || msg.includes('user-not-found')) {
        toast.error(t('toast.wrongEmailPass'))
      } else if (msg.includes('email-already-in-use')) {
        toast.error(t('toast.emailInUse'))
      } else {
        toast.error(isSignup ? t('toast.accountCreateFailed') : t('toast.loginFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* 背景デコレーション */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-rose-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-100/20 rounded-full blur-3xl" />
        <span className="absolute top-12 left-8 text-5xl opacity-10 rotate-12">🍱</span>
        <span className="absolute top-20 right-10 text-4xl opacity-10 -rotate-12">🔬</span>
        <span className="absolute bottom-24 left-12 text-4xl opacity-10 rotate-6">🔍</span>
        <span className="absolute bottom-16 right-8 text-5xl opacity-10 -rotate-6">📋</span>
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* 言語選択 */}
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex w-24 h-24 bg-gradient-to-br from-sky-100 to-blue-100 rounded-3xl items-center justify-center shadow-xl shadow-blue-100 mb-4 border-2 border-blue-200">
            <FoodEyeLogo size={72} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">FoodEye</h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">{t('login.subtitle')}</p>
        </div>

        {DEMO_MODE ? (
          /* ── ローカルモード: 1タップでスタート ── */
          <div className="space-y-4">
            <div className="card p-6 text-center">
              <p className="text-gray-500 text-sm mb-5 leading-relaxed whitespace-pre-line">
                {t('login.tap')}
              </p>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('login.loading')}
                  </span>
                ) : (
                  t('login.start')
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center leading-relaxed px-2 whitespace-pre-line">
              {t('login.warning')}
            </p>
          </div>
        ) : (
          /* ── 本番モード: Firebase 認証 ── */
          <>
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-5 text-center">
                {isSignup ? t('login.form.titleSignup') : t('login.form.titleLogin')}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('login.form.email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="example@company.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="label">{t('login.form.password')}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    placeholder={isSignup ? t('login.form.passwordHint') : ''}
                    required
                    minLength={isSignup ? 6 : 1}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('login.form.submitting')}
                    </span>
                  ) : isSignup ? (
                    t('login.form.createBtn')
                  ) : (
                    t('login.form.loginBtn')
                  )}
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-orange-500 transition-colors py-2 font-medium"
            >
              {isSignup ? t('login.form.switchToLogin') : t('login.form.switchToSignup')}
            </button>

            <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed whitespace-pre-line">
              {t('login.form.disclaimer')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
