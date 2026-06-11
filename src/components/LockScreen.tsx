'use client'

import { useAuth } from '@/context/AuthContext'
import FoodEyeLogo from './FoodEyeLogo'

export default function LockScreen() {
  const { locked, unlock } = useAuth()

  if (!locked) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-rose-50"
      style={{ touchAction: 'none' }}
    >
      {/* 背景デコレーション */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-rose-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 w-full max-w-sm">
        {/* ロゴ */}
        <div className="w-24 h-24 bg-gradient-to-br from-sky-100 to-blue-100 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 border-2 border-blue-200">
          <FoodEyeLogo size={72} />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">FoodEye</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">食品異物事故 管理・特定支援システム</p>
        </div>

        {/* ロックカード */}
        <div className="w-full bg-white rounded-3xl shadow-xl border border-orange-100 p-8 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-xl font-extrabold text-gray-800 mb-2">画面がロックされています</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            続けて使用するには<br />下のボタンをタップしてください
          </p>

          <button
            type="button"
            onClick={unlock}
            className="w-full py-5 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-extrabold text-xl rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.97] transition-transform"
          >
            ✅ ロック解除
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          ※ AI一次判定・異物仮説分析・発生源推定支援システム
        </p>
      </div>
    </div>
  )
}
