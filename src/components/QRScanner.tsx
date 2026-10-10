'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/context/LanguageContext'

interface QRScannerProps {
  onScan: (text: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const { t } = useLang()

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')

        if (!mounted) return

        const scanner = new Html5QrcodeScanner(
          'fg-qr-reader',
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            rememberLastUsedCamera: true,
          },
          false
        )

        scanner.render(
          (decoded: string) => {
            scanner.clear().catch(() => {})
            if (mounted) onScan(decoded)
          },
          () => {}
        )

        scannerRef.current = scanner
        if (mounted) setReady(true)
      } catch {
        if (mounted) setError(t('qr.scanner.cameraFail'))
      }
    })()

    return () => {
      mounted = false
      scannerRef.current?.clear().catch(() => {})
    }
  }, [onScan, t])

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 no-print">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-white">{t('record.scanQR')}</h2>
          <p className="text-gray-400 text-sm mt-1">{t('qr.scanner.hint')}</p>
        </div>

        {error ? (
          <div className="bg-red-900/40 border border-red-600/50 rounded-xl p-4 text-red-300 text-center text-sm mb-4">
            {error}
          </div>
        ) : (
          <div
            id="fg-qr-reader"
            className="w-full rounded-2xl overflow-hidden border border-gray-700"
          />
        )}

        {!ready && !error && (
          <p className="text-gray-500 text-sm text-center mt-3 animate-pulse">
            {t('qr.scanner.loading')}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-colors text-lg"
        >
          {t('common.cancel')}
        </button>

        <p className="text-xs text-gray-600 text-center mt-3">
          {t('qr.scanner.supported')}
        </p>
      </div>
    </div>
  )
}
