import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import FloatingLanguageButton from '@/components/FloatingLanguageButton'

export const metadata: Metadata = {
  title: 'FoodEye | 食品異物事故管理・特定支援システム',
  description: 'FoodEye - 食品異物の一次判定・ロット追跡・報告書自動生成システム',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <LanguageProvider>
          <AuthProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <FloatingLanguageButton />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1F2937',
                  color: '#fff',
                  border: '1px solid #374151',
                },
                success: { iconTheme: { primary: '#F97316', secondary: '#fff' } },
              }}
            />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
