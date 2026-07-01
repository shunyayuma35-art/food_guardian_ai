'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { DEMO_MODE, app } from '@/lib/firebase'

interface AuthUser {
  uid: string
  email: string
  displayName: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  locked: boolean
  lock: () => void
  unlock: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEMO_USER_KEY = 'food_guardian_demo_user'
const DEMO_USER: AuthUser = {
  uid: 'demo-user-001',
  email: 'demo@foodguardian.ai',
  displayName: 'デモユーザー',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // DEMO_MODEは同期的に即時ログイン（ローディング画面を出さない）
  const [user, setUser] = useState<AuthUser | null>(DEMO_MODE ? DEMO_USER : null)
  const [loading, setLoading] = useState(!DEMO_MODE)
  // タブを開くたびにロック画面を表示し、一度解除したら同セッション中は再表示しない
  const [locked, setLocked] = useState(true)

  useEffect(() => {
    if (sessionStorage.getItem('foodeye_unlocked') === '1') setLocked(false)
  }, [])

  function lock() {
    setLocked(true)
    sessionStorage.removeItem('foodeye_unlocked')
  }

  function unlock() {
    setLocked(false)
    sessionStorage.setItem('foodeye_unlocked', '1')
  }

  useEffect(() => {
    if (DEMO_MODE) {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(DEMO_USER))
      return
    }

    let unsubscribe: (() => void) | undefined
    ;(async () => {
      const { getAuth, onAuthStateChanged } = await import('firebase/auth')
      const auth = getAuth(app!)
      unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? '',
            displayName: fbUser.displayName ?? fbUser.email ?? '',
          })
        } else {
          setUser(null)
        }
        setLoading(false)
      })
    })()

    return () => unsubscribe?.()
  }, [])

  async function login(email: string, password: string) {
    if (DEMO_MODE) {
      const u: AuthUser = { uid: 'demo-user-001', email, displayName: email.split('@')[0] }
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(u))
      setUser(u)
      return
    }
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
    const auth = getAuth(app!)
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signup(email: string, password: string) {
    if (DEMO_MODE) {
      const u: AuthUser = { uid: 'demo-user-001', email, displayName: email.split('@')[0] }
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(u))
      setUser(u)
      return
    }
    const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth')
    const auth = getAuth(app!)
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (DEMO_MODE) {
      localStorage.removeItem(DEMO_USER_KEY)
      setUser(null)
      return
    }
    const { getAuth, signOut } = await import('firebase/auth')
    const auth = getAuth(app!)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, locked, lock, unlock, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
