'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import toast from 'react-hot-toast'

export default function QRPage() {
  const router = useRouter()
  const [serverUrl, setServerUrl] = useState('')
  const [serverIp, setServerIp] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // サーバーの実際のIPアドレスをAPIから取得
    fetch('/api/server-info')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.url) {
          setServerUrl(data.url)
          setServerIp(data.ip)
        } else {
          // フォールバック: localhostの場合はそのまま表示
          setServerUrl(window.location.origin)
          setServerIp('localhost')
        }
      })
      .catch(() => {
        setServerUrl(window.location.origin)
        setServerIp('localhost')
      })
      .finally(() => setLoading(false))
  }, [])

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(serverUrl)
      setCopied(true)
      toast.success('URLをコピーしました 📋')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // クリップボードAPIが使えない場合（一部Android）
      const el = document.createElement('textarea')
      el.value = serverUrl
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      toast.success('URLをコピーしました 📋')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const isLocalhost = serverIp === 'localhost' || serverIp === '127.0.0.1'

  return (
    <div className="min-h-screen pb-24">
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/')} className="back-btn shrink-0">←</button>
          <div>
            <h1 className="font-extrabold text-gray-800 text-lg leading-tight">QRコード共有</h1>
            <p className="text-xs text-gray-500">スタッフのスマホ・タブレットに展開</p>
          </div>
        </div>
      </header>

      <div className="max-w-sm mx-auto px-5 py-6 space-y-5">

        {/* バナー */}
        <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-3xl p-5 text-center shadow-lg shadow-violet-200">
          <div className="text-5xl mb-2">📲</div>
          <h2 className="text-white text-xl font-extrabold">FoodEye を共有</h2>
          <p className="text-white/80 text-sm mt-1">
            同じ Wi-Fi のスマホ・タブレットから<br />すぐにアクセスできます
          </p>
        </div>

        {/* 接続状態バナー */}
        {!loading && (
          isLocalhost ? (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
              <p className="text-red-700 text-sm font-bold">⚠️ スマホから接続できない状態です</p>
              <p className="text-gray-700 text-xs mt-2 leading-relaxed">
                サーバーPCが <span className="font-mono font-bold text-red-600">localhost</span> で認識されています。<br />
                下記の手順でサーバーを正しく起動してください。
              </p>
              <div className="mt-3 bg-red-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-red-800">【解決手順】</p>
                <p className="text-xs text-red-700">① 現在のサーバーを停止（Ctrl+C）</p>
                <p className="text-xs text-red-700">② <span className="font-mono bg-red-200 px-1 rounded">FoodEye起動.bat</span> をダブルクリック</p>
                <p className="text-xs text-red-700">③ 表示されたIPアドレスでQRを再生成</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
              <p className="text-green-700 text-sm font-bold">✅ スマホから接続できます</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                サーバーIP: <span className="font-mono font-bold text-green-700">{serverIp}</span><br />
                同じ Wi-Fi に接続したすべての端末でアクセスできます。
              </p>
            </div>
          )
        )}

        {/* QRコード */}
        <div className="bg-white rounded-3xl border border-orange-100 shadow-md p-6 flex flex-col items-center">
          {loading ? (
            <div className="w-[210px] h-[210px] bg-violet-50 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isLocalhost ? (
            <div className="w-[210px] h-[210px] bg-red-50 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-red-300">
              <span className="text-4xl">⚠️</span>
              <p className="text-xs text-red-600 font-bold text-center px-3">
                QRコードを生成できません<br />上記の手順で再起動してください
              </p>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-2xl border-2 border-violet-200 shadow-inner">
              <QRCodeSVG
                value={serverUrl}
                size={210}
                level="H"
                includeMargin={false}
                fgColor="#1f2937"
                bgColor="#ffffff"
                imageSettings={{
                  src: "data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='42' cy='44' r='36' fill='white' stroke='%23e2e8f0' stroke-width='2'/%3E%3Ccircle cx='34' cy='41' r='5.5' fill='%231e40af'/%3E%3Ccircle cx='50' cy='41' r='5.5' fill='%231e40af'/%3E%3Ccircle cx='36' cy='39' r='1.8' fill='white'/%3E%3Ccircle cx='52' cy='39' r='1.8' fill='white'/%3E%3Cpath d='M 31 54 Q 42 63 53 54' stroke='%23374151' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3Cline x1='70' y1='71' x2='87' y2='88' stroke='%232563eb' stroke-width='7' stroke-linecap='round'/%3E%3Ccircle cx='63' cy='64' r='20' fill='rgba(219%2C234%2C254%2C0.45)' stroke='%232563eb' stroke-width='5.5'/%3E%3C/svg%3E",
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
          )}
          {!loading && !isLocalhost && (
            <p className="text-xs text-gray-500 mt-3 font-medium text-center">
              カメラを向けてスキャン 📷
            </p>
          )}
        </div>

        {/* URL表示 */}
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">アクセスURL（タップでコピー）</p>
          <div className="flex items-center gap-2">
            <button
              onClick={copyUrl}
              className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-left overflow-hidden active:bg-violet-100 transition-all"
            >
              <p className="text-xs text-violet-700 font-mono truncate font-bold">
                {loading ? '取得中...' : serverUrl}
              </p>
            </button>
            <button
              onClick={copyUrl}
              disabled={loading || isLocalhost}
              className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                copied
                  ? 'bg-green-500 text-white shadow-md shadow-green-200'
                  : 'bg-violet-500 hover:bg-violet-600 text-white shadow-md shadow-violet-200'
              }`}
            >
              {copied ? '✓ コピー済' : 'コピー'}
            </button>
          </div>
        </div>

        {/* 使い方ガイド */}
        <UsageGuide
          title="📖 QR共有・スマホ接続の手順"
          color="purple"
          steps={[
            { icon: '📶', title: 'スマホを同じWi-Fiに接続する', desc: 'サーバーPCと同じWi-Fiネットワークにスマホ・タブレットを接続してください。別のネットワークでは接続できません。' },
            { icon: '📷', title: 'カメラでQRコードをスキャン', desc: 'スマホの標準カメラアプリでQRコードを読み取ります。QRリーダーアプリは不要です。' },
            { icon: '🔗', title: '表示されたリンクをタップ', desc: '「http://10.x.x.x:3001」のようなURLが表示されます。タップするとFoodEyeが開きます。' },
            { icon: '🔒', title: 'ロック解除してログイン', desc: '「✅ ロック解除・ログイン」ボタンをタップするとすぐに使えます。' },
            { icon: '📌', title: 'ブックマーク登録で次回から簡単に', desc: 'ブラウザの「ブックマーク追加」でURLを保存しておくと、次回からQRスキャンなしでアクセスできます。' },
          ]}
          tips={[
            'URLをコピーして社内グループLINEに貼り付けると全員に共有できます',
            'QRコードを印刷して作業場の壁に貼っておくと現場での利用が便利です',
            'サーバーPCを再起動するとIPアドレスが変わる場合があります。変わった場合はこの画面で新しいQRを確認してください',
          ]}
        />

        {/* 使い方ステップ */}
        {!isLocalhost && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-600 mb-3">📱 スマホでの使い方</p>
            <div className="space-y-2.5">
              {[
                'サーバーPC と同じ Wi-Fi に接続する',
                'スマホのカメラでQRコードをスキャン',
                '表示されたリンクをタップ',
                'ログインして使い始める',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-600 mb-2">⚠️ 注意事項</p>
          <div className="space-y-1.5">
            {[
              'スマホとサーバーPCが同じ Wi-Fi に接続していること',
              'サーバーPCのファイアウォールでポート3001を開放済みであること',
              'サーバーPCがスリープしていないこと',
            ].map((text, i) => (
              <p key={i} className="text-xs text-gray-500 leading-relaxed">・{text}</p>
            ))}
          </div>
        </div>

      </div>

      <Navigation />
    </div>
  )
}
