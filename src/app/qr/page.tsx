'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import FoodEyeLogo from '@/components/FoodEyeLogo'
import { useLang } from '@/context/LanguageContext'
import { DEMO_MODE } from '@/lib/firebase'
import toast from 'react-hot-toast'

export default function QRPage() {
  const router = useRouter()
  const { t } = useLang()
  const [serverUrl, setServerUrl] = useState('')
  const [serverIp, setServerIp] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const origin = window.location.origin

    // HTTPS（Vercel等の公開URL）の場合はAPIを叩かずそのまま使う
    if (origin.startsWith('https://')) {
      setServerUrl(origin)
      setServerIp('cloud')
      setLoading(false)
      return
    }

    // ローカルモード：LANのIPを取得
    fetch('/api/server-info')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.url && data.ip !== '127.0.0.1') {
          setServerUrl(data.url)
          setServerIp(data.ip)
        } else {
          setServerUrl(origin)
          setServerIp('localhost')
        }
      })
      .catch(() => {
        setServerUrl(origin)
        setServerIp('localhost')
      })
      .finally(() => setLoading(false))
  }, [])

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(serverUrl)
      setCopied(true)
      toast.success(t('qr.toast.copied'))
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const el = document.createElement('textarea')
      el.value = serverUrl
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      toast.success(t('qr.toast.copied'))
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const isCloud = serverIp === 'cloud'
  const isLocalhost = !isCloud && (serverIp === 'localhost' || serverIp === '127.0.0.1')

  return (
    <div className="min-h-screen pb-24">
      <header className="bg-white/85 backdrop-blur-xl border-b border-orange-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/')} className="back-btn shrink-0">←</button>
          <div>
            <h1 className="font-extrabold text-gray-800 text-lg leading-tight">{t('qr.pageTitle')}</h1>
            <p className="text-xs text-gray-500">{t('qr.pageSubtitle')}</p>
          </div>
        </div>
      </header>

      <div className="max-w-sm mx-auto px-5 py-6 space-y-5">

        {/* バナー — キャラクター大きめ */}
        <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-3xl p-6 text-center shadow-lg shadow-violet-200">
          <div className="flex justify-center mb-4">
            <div className="w-28 h-28 bg-white/90 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-300 border-4 border-white">
              <FoodEyeLogo size={88} />
            </div>
          </div>
          <h2 className="text-white text-xl font-extrabold">{t('qr.banner.prefix')}FoodEye{t('qr.banner.suffix')}</h2>
          <p className="text-white/80 text-sm mt-1 whitespace-pre-line">
            {t('qr.banner.desc')}
          </p>
          {DEMO_MODE && (
            <p className="text-white/60 text-[10px] mt-2 leading-relaxed">
              {t('qr.demo.note')}
            </p>
          )}
        </div>

        {/* 接続状態バナー */}
        {!loading && (
          isCloud ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
              <p className="text-green-700 text-sm font-bold">{t('qr.cloud.status')}</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                {t('qr.cloud.desc')}<br />
                <span className="font-mono font-bold text-green-700 break-all">{serverUrl}</span>
              </p>
            </div>
          ) : isLocalhost ? (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
              <p className="text-red-700 text-sm font-bold">{t('qr.local.status')}</p>
              <p className="text-gray-700 text-xs mt-2 leading-relaxed">
                {t('qr.local.pcIs')} <span className="font-mono font-bold text-red-600">localhost</span>{t('qr.local.pcAt')}<br />
                {t('qr.local.restartGuide')}
              </p>
              <div className="mt-3 bg-red-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-red-800">{t('qr.local.fixTitle')}</p>
                <p className="text-xs text-red-700">{t('qr.local.fix1')}</p>
                <p className="text-xs text-red-700">{t('qr.local.fix2')}</p>
                <p className="text-xs text-red-700">{t('qr.local.fix3')}</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
              <p className="text-green-700 text-sm font-bold">{t('qr.wifi.status')}</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                {t('qr.wifi.serverIp')} <span className="font-mono font-bold text-green-700">{serverIp}</span><br />
                {t('qr.wifi.wifiDesc')}
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
                {t('qr.error.title')}<br />{t('qr.error.desc')}
              </p>
            </div>
          ) : serverUrl ? (
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
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
              />
            </div>
          ) : null}
          {!loading && !isLocalhost && serverUrl && (
            <p className="text-xs text-gray-500 mt-3 font-medium text-center">
              {t('qr.scan')}
            </p>
          )}
        </div>

        {/* URL表示 */}
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">{t('qr.url.label')}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={copyUrl}
              className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-left overflow-hidden active:bg-violet-100 transition-all"
            >
              <p className="text-xs text-violet-700 font-mono truncate font-bold">
                {loading ? t('qr.url.loading') : serverUrl}
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
              {copied ? t('qr.copy.done') : t('qr.copy.btn')}
            </button>
          </div>
        </div>

        {/* 使い方ガイド */}
        <UsageGuide
          title={t('qr.guide.title')}
          color="purple"
          steps={[
            { icon: '📶', title: t('qr.guide.step1.title'), desc: t('qr.guide.step1.desc') },
            { icon: '📷', title: t('qr.guide.step2.title'), desc: t('qr.guide.step2.desc') },
            { icon: '🔗', title: t('qr.guide.step3.title'), desc: t('qr.guide.step3.desc') },
            { icon: '📌', title: t('qr.guide.step4.title'), desc: t('qr.guide.step4.desc') },
          ]}
          tips={[
            t('qr.guide.tip1'),
            t('qr.guide.tip2'),
            t('qr.guide.tip3'),
          ]}
        />

        {/* 使い方ステップ */}
        {!isLocalhost && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-600 mb-3">{t('qr.phone.title')}</p>
            <div className="space-y-2.5">
              {[
                t('qr.phone.step1'),
                t('qr.phone.step2'),
                t('qr.phone.step3'),
                t('qr.phone.step4'),
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
          <p className="text-xs font-bold text-gray-600 mb-2">{t('qr.caution.title')}</p>
          <div className="space-y-1.5">
            {[
              t('qr.caution.1'),
              t('qr.caution.2'),
              t('qr.caution.3'),
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
