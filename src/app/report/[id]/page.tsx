'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getReport, updateReport, deleteReport, listReports } from '@/lib/firestore'
import { reportToWordHTML } from '@/lib/report-generator'
import Navigation from '@/components/Navigation'
import toast from 'react-hot-toast'
import type { Report } from '@/lib/types'
import Link from 'next/link'

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const router = useRouter()

  const [report, setReport] = useState<Report | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [allReports, setAllReports] = useState<Report[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const [r, all] = await Promise.all([
      getReport(id),
      listReports(user.uid),
    ])
    setReport(r)
    setAllReports(all)
    if (r) {
      setEditContent(r.content)
      setEditTitle(r.title)
    }
    setFetching(false)
  }, [id, user])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  async function handleSave() {
    if (!report) return
    setSaving(true)
    await updateReport(id, { content: editContent, title: editTitle })
    setReport({ ...report, content: editContent, title: editTitle })
    setEditing(false)
    toast.success('保存しました ✅')
    setSaving(false)
  }

  async function handleDelete() {
    await deleteReport(id)
    toast.success('削除しました')
    router.replace('/')
  }

  function downloadWord() {
    if (!report) return
    const html = reportToWordHTML(report.title, report.content)
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[/\\:*?"<>|]/g, '_')}.doc`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Word文書をダウンロードしました 📘')
  }

  function downloadTxt() {
    if (!report) return
    const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[/\\:*?"<>|]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('テキストファイルをダウンロードしました')
  }

  async function copyToClipboard() {
    if (!report) return
    const text = `${report.title}\n${'─'.repeat(40)}\n${report.content}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('クリップボードにコピーしました 📋')
    } catch {
      // fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast.success('コピーしました 📋')
    }
  }

  async function handleShare() {
    if (!report) return
    const text = `${report.title}\n${'─'.repeat(40)}\n${report.content}`
    if (navigator.share) {
      try {
        await navigator.share({ title: report.title, text })
        toast.success('共有しました ✅')
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          await copyToClipboard()
        }
      }
    } else {
      await copyToClipboard()
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">報告書が見つかりません</p>
        <button onClick={() => router.push('/')} className="btn-primary">ホームに戻る</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* 削除確認 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-lg font-extrabold text-gray-800 mb-2">削除の確認</p>
            <p className="text-sm text-gray-500 mb-6">この報告書を削除しますか？この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm">キャンセル</button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm shadow-md shadow-red-200">削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* サイドバー（フォルダ） */}
      {showSidebar && (
        <div className="fixed inset-0 z-[90] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSidebar(false)} />
          <div className="relative z-10 w-72 h-full bg-white shadow-2xl overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-5">
              <p className="text-white font-extrabold text-base">📁 報告書フォルダ</p>
              <p className="text-white/80 text-xs mt-0.5">全 {allReports.length} 件</p>
            </div>
            <div className="p-3 space-y-1">
              {allReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/report/${r.id}`}
                  onClick={() => setShowSidebar(false)}
                  className={`block p-3 rounded-xl transition-all ${
                    r.id === id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-xs font-bold truncate ${r.id === id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {r.type === 'incident' ? '🔴' : '🔵'} {r.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(r.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                </Link>
              ))}
              {allReports.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">報告書はまだありません</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-blue-100 shadow-sm px-5 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.push('/')} className="back-btn shrink-0">←</button>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm font-bold text-gray-800 border-b-2 border-blue-400 bg-transparent outline-none py-0.5"
                />
              ) : (
                <h1 className="font-extrabold text-gray-800 text-sm leading-tight truncate">{report.title}</h1>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(report.createdAt).toLocaleDateString('ja-JP')} 生成
                {report.updatedAt !== report.createdAt && ' · 編集済み'}
              </p>
            </div>
            <button
              onClick={() => setShowSidebar(true)}
              className="shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm hover:bg-blue-200 transition-all"
            >
              📁
            </button>
          </div>

          {/* ツールバー */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {saving ? '保存中...' : '✅ 保存'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditContent(report.content); setEditTitle(report.title) }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-gray-200 text-gray-600 text-xs font-bold"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200"
                >
                  ✏️ 編集
                </button>
                <button onClick={handleShare} className="shrink-0 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">
                  📤 共有
                </button>
                <button onClick={copyToClipboard} className="shrink-0 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">
                  📋 コピー
                </button>
                <button onClick={downloadWord} className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200">
                  📘 Word
                </button>
                <button onClick={downloadTxt} className="shrink-0 px-3 py-1.5 rounded-xl bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200">
                  📄 TXT
                </button>
                <button onClick={handlePrint} className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200">
                  🖨️ 印刷
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="shrink-0 px-3 py-1.5 rounded-xl bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200">
                  🗑️ 削除
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5">
        {editing ? (
          /* 編集モード */
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-semibold mb-2">✏️ 報告書を編集（自由に修正できます）</p>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={40}
              className="w-full font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-400 resize-none leading-relaxed"
            />
          </div>
        ) : (
          /* 表示モード */
          <div>
            {/* バナー */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl p-5 mb-4 shadow-lg shadow-blue-200">
              <div className="text-3xl mb-2">📄</div>
              <p className="text-white font-extrabold text-lg leading-tight">{report.title}</p>
              <p className="text-white/70 text-xs mt-1">
                {report.type === 'incident' ? '異物混入クレーム報告書' : '官能検査報告書'} ·
                生成：{new Date(report.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>

            {/* 注意バナー */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
              <p className="text-amber-700 text-xs font-bold">✏️ 報告書は編集できます</p>
              <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">
                「編集」ボタンで内容を修正し、「保存」で更新されます。
                Word・TXT でダウンロードして社内編集も可能です。
              </p>
            </div>

            {/* 報告書本文 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 print:shadow-none print:border-0">
              <pre className="text-xs text-gray-800 font-mono leading-relaxed whitespace-pre-wrap break-words">
                {report.content}
              </pre>
            </div>

            {/* エクスポートパネル */}
            <div className="mt-4 card p-5">
              <p className="section-title">📤 エクスポート・外部共有</p>

              {/* 外部共有ボタン（最優先） */}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-extrabold text-base shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] mb-3"
              >
                <span className="text-2xl">📤</span>
                <div className="text-left">
                  <p className="text-sm font-extrabold">外部アプリへ共有</p>
                  <p className="text-xs text-white/70 font-normal">LINE・メール・メモなどに直接送信</p>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-purple-100 text-purple-700 font-bold text-sm transition-all active:scale-[0.98] hover:bg-purple-200"
                >
                  <span>📋</span> テキストコピー
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-green-100 text-green-700 font-bold text-sm transition-all active:scale-[0.98] hover:bg-green-200"
                >
                  <span>🖨️</span> PDF印刷
                </button>
                <button
                  onClick={downloadWord}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  <span>📘</span> Word (.doc)
                </button>
                <button
                  onClick={downloadTxt}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gray-600 text-white font-bold text-sm shadow-md shadow-gray-300 transition-all active:scale-[0.98]"
                >
                  <span>📄</span> TXT
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
                「外部共有」はLINE・メール・Slack等へ直接送れます。<br />
                スマートフォンではアプリ選択画面が開きます。
              </p>
            </div>
          </div>
        )}
      </div>

      <Navigation />

      {/* 印刷スタイル */}
      <style jsx global>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white; }
          pre { font-size: 10pt; line-height: 1.6; }
        }
      `}</style>
    </div>
  )
}
