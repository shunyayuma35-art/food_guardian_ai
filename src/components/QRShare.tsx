'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { useLang } from '@/context/LanguageContext'

interface QRShareProps {
  onClose: () => void
}

export default function QRShare({ onClose }: QRShareProps) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const { t } = useLang()

  useEffect(() => {
    setUrl(window.location.origin)
  }, [])

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('qr.toast.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('qr.sharePanel.copyFail'))
    }
  }

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1')

  const steps = [
    t('qr.sharePanel.step1'),
    t('qr.sharePanel.step2'),
    t('qr.sharePanel.step3'),
    t('qr.sharePanel.step4'),
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 no-print"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-rose-400 px-6 pt-6 pb-8 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-lg transition-colors"
          >
            ✕
          </button>
          <div className="text-5xl mb-2">📱</div>
          <h2 className="text-white text-xl font-extrabold">{t('qr.sharePanel.title')}</h2>
          <p className="text-white/80 text-sm mt-1">{t('qr.sharePanel.subtitle')}</p>
        </div>

        {/* QRコードエリア */}
        <div className="-mt-6 mx-6 bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border border-orange-100">
          {url ? (
            <div className="p-3 bg-white rounded-xl border-2 border-orange-200 shadow-inner">
              <QRCodeSVG
                value={url}
                size={200}
                level="H"
                includeMargin={false}
                fgColor="#1f2937"
                bgColor="#ffffff"
                imageSettings={{
                  src: "data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='42' cy='44' r='36' fill='white' stroke='%23e2e8f0' stroke-width='2'/%3E%3Ccircle cx='28' cy='52' r='6' fill='%23fca5a5' opacity='0.55'/%3E%3Ccircle cx='56' cy='52' r='6' fill='%23fca5a5' opacity='0.55'/%3E%3Ccircle cx='34' cy='41' r='5.5' fill='%231e40af'/%3E%3Ccircle cx='50' cy='41' r='5.5' fill='%231e40af'/%3E%3Ccircle cx='36' cy='39' r='1.8' fill='white'/%3E%3Ccircle cx='52' cy='39' r='1.8' fill='white'/%3E%3Cpath d='M 31 54 Q 42 63 53 54' stroke='%23374151' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3Cline x1='70' y1='71' x2='87' y2='88' stroke='%232563eb' stroke-width='7' stroke-linecap='round'/%3E%3Ccircle cx='63' cy='64' r='20' fill='rgba(219%2C234%2C254%2C0.45)' stroke='%232563eb' stroke-width='5.5'/%3E%3C/svg%3E",
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            </div>
          ) : (
            <div className="w-[200px] h-[200px] bg-orange-50 rounded-xl flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3 text-center font-medium">
            {t('qr.sharePanel.scanHint')}
          </p>
        </div>

        {/* URL表示 */}
        <div className="px-6 mt-4">
          <p className="text-xs text-gray-500 font-semibold mb-1.5">{t('qr.sharePanel.urlLabel')}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 overflow-hidden">
              <p className="text-xs text-orange-700 font-mono truncate font-bold">{url}</p>
            </div>
            <button
              onClick={copyUrl}
              className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                copied
                  ? 'bg-green-500 text-white shadow-md shadow-green-200'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-200'
              }`}
            >
              {copied ? t('qr.copy.done') : t('qr.copy.btn')}
            </button>
          </div>
        </div>

        {/* 注意事項 */}
        {isLocalhost ? (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-amber-700 text-xs font-bold">{t('qr.sharePanel.localHint')}</p>
            <p className="text-gray-600 text-xs mt-1 leading-relaxed">
              {t('qr.sharePanel.localDesc')}
            </p>
          </div>
        ) : (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-2xl p-3">
            <p className="text-green-700 text-xs font-bold">{t('qr.sharePanel.networkOk')}</p>
            <p className="text-gray-600 text-xs mt-1 leading-relaxed">
              {t('qr.sharePanel.networkDesc')}
            </p>
          </div>
        )}

        {/* ステップ説明 */}
        <div className="px-6 mt-4 mb-6">
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
            {steps.map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-gray-600 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
