'use client'

import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import Navigation from '@/components/Navigation'
import { useLang } from '@/context/LanguageContext'
import ImageEnhancer from '@/components/ImageEnhancer'
import ForeignMatterVisualizer from '@/components/ForeignMatterVisualizer'
import ComparisonPanel from '@/components/ComparisonPanel'
import AgentPanel from '@/components/AgentPanel'
import toast from 'react-hot-toast'
import { compressImage, compressDataUrl } from '@/lib/compressImage'

interface AnalysisResult {
  urgency: 'high' | 'medium' | 'low'
  candidates: { name: string; probability: number; reason: string }[]
  visualFeatures: string[]
  quickReplies: string[]
}

interface SearchResult {
  result: string
}

interface ImageAnalysisResult {
  result: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string   // ユーザーが送った画像（表示用）
  analysis?: AnalysisResult
  searchResult?: SearchResult
  imageAnalysis?: ImageAnalysisResult
  quickReplies?: string[]
  timestamp: Date
}

function AnalysisCard({ analysis, urgencyLabels, candidatesLabel, visualLabel }: {
  analysis: AnalysisResult
  urgencyLabels: Record<string, { text: string; bg: string; border: string; dot: string; textColor: string }>
  candidatesLabel: string
  visualLabel: string
}) {
  const u = urgencyLabels[analysis.urgency]
  return (
    <div className={`mt-2 rounded-xl border ${u.border} ${u.bg} p-3 space-y-2.5`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${u.dot} animate-pulse`} />
        <span className={`text-xs font-bold ${u.textColor}`}>{u.text}</span>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{candidatesLabel}</p>
        <div className="space-y-1.5">
          {analysis.candidates.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-xs font-bold w-4 shrink-0 mt-0.5 ${i === 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-800 truncate">{c.name}</span>
                  <span className={`text-xs font-bold shrink-0 ${i === 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {c.probability}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1 mt-0.5">
                  <div
                    className={`h-1 rounded-full ${i === 0 ? 'bg-orange-400' : 'bg-gray-400'}`}
                    style={{ width: `${c.probability}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{c.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 目視特徴 */}
      {analysis.visualFeatures.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{visualLabel}</p>
          <div className="flex flex-wrap gap-1">
            {analysis.visualFeatures.map((f, i) => (
              <span key={i} className="text-[10px] bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg, onQuickReply, analysisRef, onStartAgent }: { msg: Message; onQuickReply: (text: string) => void; analysisRef?: RefObject<HTMLDivElement>; onStartAgent?: (analysis: AnalysisResult) => void }) {
  const { t, lang } = useLang()
  const urgencyLabels = {
    high:   { text: t('aichat.urgency.high'), bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', textColor: 'text-red-700' },
    medium: { text: t('aichat.urgency.medium'), bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', textColor: 'text-amber-700' },
    low:    { text: t('aichat.urgency.low'), bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', textColor: 'text-green-700' },
  }
  const isAI = msg.role === 'assistant'
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-3`}>
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div className={`${msg.imageAnalysis ? 'w-full' : 'max-w-[85%]'}`}>
        {/* ユーザーが送った画像 */}
        {msg.imageUrl && (
          <div className="mb-2 rounded-xl overflow-hidden border-2 border-orange-200 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={msg.imageUrl} alt="異物写真" className="w-full max-h-48 object-cover" />
          </div>
        )}

        {/* メッセージ本文 */}
        {msg.content && (
          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isAI
              ? 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-none'
              : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-none'
          }`}>
            {msg.content}
          </div>
        )}

        {/* AI 解析カード */}
        {msg.analysis && (
          <>
            <AnalysisCard analysis={msg.analysis} urgencyLabels={urgencyLabels} candidatesLabel={t('aichat.candidates')} visualLabel={t('aichat.visualFeatures')} />
            {onStartAgent && (
              <button
                onClick={() => onStartAgent(msg.analysis!)}
                className="mt-2 w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                🤖 {lang === 'en' ? 'Start AI Agent Response' : 'エージェントで対応を進める'}
              </button>
            )}
          </>
        )}

        {/* Claude 検索結果 */}
        {msg.searchResult && (
          <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-2">{t('aichat.searchResult')}</p>
            <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
              {stripMarkdown(msg.searchResult.result)}
            </div>
          </div>
        )}

        {/* 画像解析結果（スマホ全幅・text-sm で読みやすく） */}
        {msg.imageAnalysis && (
          <div ref={analysisRef} className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide mb-2">{t('aichat.imageAnalysis')}</p>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {msg.imageAnalysis.result}
            </div>
          </div>
        )}

        {/* クイックリプライボタン */}
        {msg.quickReplies && msg.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(qr)}
                className="text-xs px-3 py-1.5 bg-white border border-orange-300 text-orange-600 rounded-full hover:bg-orange-50 active:scale-95 transition-all font-medium"
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        <p className={`text-[9px] mt-1 ${isAI ? 'text-gray-400' : 'text-orange-300 text-right'}`}>
          {msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 mr-2 mt-1">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

/** API 呼び出し直前に localStorage から最新の lang を読む（SSR では 'ja' を返す） */
function getStoredLang(): string {
  if (typeof window === 'undefined') return 'ja'
  return localStorage.getItem('foodeye_lang') ?? 'ja'
}

/**
 * 「画像を解析」(/api/analyze-foreign-matter) のテキスト結果から
 * エージェントに渡す AnalysisResult を生成する。
 * urgency を確実に取り出し、候補名は 1 件合成する（確率 75 固定）。
 */
function parseImageAnalysisToAnalysis(text: string, isEn: boolean): AnalysisResult | undefined {
  if (!text) return undefined

  // ── urgency ──
  let urgency: 'high' | 'medium' | 'low' = 'medium'
  if (isEn) {
    const m = text.match(/\[Urgency\][^\n]*(High|Medium|Low)/i)
    if (m) urgency = m[1].toLowerCase() as 'high' | 'medium' | 'low'
    else if (/urgency[^.\n]*\bHigh\b/i.test(text)) urgency = 'high'
    else if (/urgency[^.\n]*\bLow\b/i.test(text)) urgency = 'low'
  } else {
    if (/【緊急度】\s*高/.test(text) || /緊急度[：:]\s*高/.test(text)) urgency = 'high'
    else if (/【緊急度】\s*低/.test(text) || /緊急度[：:]\s*低/.test(text)) urgency = 'low'
  }

  // ── 候補名（先頭行から抽出）──
  const firstLine = text.split('\n').find(l => l.trim()) ?? ''
  let candidateName = isEn ? 'Unknown foreign matter' : '不明な異物'
  if (isEn) {
    const m = firstLine.match(/Estimated foreign matter[：:]\s*([^(（\n]+)/i)
    if (m) candidateName = m[1].trim()
  } else {
    const m = firstLine.match(/推定される異物[：:]\s*([^（(\n]+)/)
    if (m) candidateName = m[1].trim()
    else if (firstLine.trim()) candidateName = firstLine.replace(/（.*?）/g, '').trim().slice(0, 30)
  }

  // ── 目視特徴（物理的特徴セクション）──
  const visualFeatures: string[] = []
  const sect = isEn
    ? text.match(/\[Physical features?\][^\n]*\n?([^\[]+)/i)
    : text.match(/【物理的特徴】[^\n]*\n?([^【]+)/)
  if (sect) {
    const parts = sect[1].trim().split(/[・,、]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 20).slice(0, 5)
    visualFeatures.push(...parts)
  }

  return {
    urgency,
    candidates: [{ name: candidateName, probability: 75, reason: '' }],
    visualFeatures,
    quickReplies: [],
  }
}

/** 検索結果表示用：Markdown 記号を除去してプレーンテキストにする */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*]\s+/gm, '• ')
    .trim()
}

export default function AiChatPage() {
  const { t, lang } = useLang()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageOriginalDataUrl, setImageOriginalDataUrl] = useState<string | null>(null)
  const [imageEnhancedDataUrl, setImageEnhancedDataUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [visualizerDataUrl, setVisualizerDataUrl] = useState<string | null>(null)
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [agentAnalysis, setAgentAnalysis] = useState<AnalysisResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null)
  const [userHint, setUserHint] = useState('')
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastAnalysisRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<File | null>(null)
  const chatHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const dragCounterRef = useRef(0)

  const QUICK_SUGGESTIONS = lang === 'en'
    ? ['Insects', 'Metal fragment', 'Wire / metal wire', 'Plastic piece', 'Rubber piece',
       'Glass fragment', 'Hair', 'Bone fragment', 'Wood / paper', 'Seed / pit', 'Plant material']
    : ['虫類', '金属片', '針金・金属線', 'プラスチック片', 'ゴム片',
       'ガラス片', '毛髪・体毛', '骨片', '木片・紙片', '種・核', '植物片']

  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (!loading && lastMsg?.imageAnalysis && lastAnalysisRef.current) {
      lastAnalysisRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, searchLoading])

  // 初回 + 言語変更時のウェルカムメッセージ（会話が始まっていない場合のみ更新）
  useEffect(() => {
    setMessages(prev => {
      const isInitial = prev.length === 0 ||
        (prev.length === 1 && prev[0].id === 'welcome')
      if (!isInitial) return prev
      return [{ id: 'welcome', role: 'assistant' as const, content: t('aichat.welcome'), quickReplies: [], timestamp: new Date() }]
    })
  }, [t])

  const handleImage = useCallback((file: File) => {
    // 20MB 超は拒否（canvas が OOM になる恐れ）
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('toast.imageSize') + ` (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('toast.imageFormat'));
      return;
    }

    imageFileRef.current = file;  // 圧縮時に使うために保持

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setShowPanel(true);
    setMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageOriginalDataUrl(result);
      setVisualizerDataUrl(result);  // persists after analysis for visualizer
      // fallback: raw base64 until ImageEnhancer calls onEnhanced
      setImageBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImage(file)
    e.target.value = ''
  }, [handleImage])

  const handleEnhanced = useCallback((base64: string, dataUrl: string) => {
    setImageBase64(base64)
    setImageEnhancedDataUrl(dataUrl)
  }, [])

  const handleClaudeSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      toast.error(t('toast.enterKeyword'));
      return;
    }

    setSearchLoading(true);
    const timeoutId = setTimeout(() => {
      setSearchLoading(false);
      toast.error(t('toast.timeout'));
    }, 35000);

    try {
      const res = await fetch('/api/claude-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, lang: getStoredLang() }),
        signal: AbortSignal.timeout(30000),
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error ?? t('toast.searchFailed'));
        setSearchLoading(false);
        return;
      }

      const searchMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.result ?? '',
        searchResult: data,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, searchMsg]);
      setSearchQuery('');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error(t('toast.timeout'));
      } else {
        toast.error(t('toast.networkError'));
      }
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery])

  const handleImageUploadAnalysis = useCallback(async () => {
    if (!imageBase64) return;

    setCompressing(true);
    setLoading(true);
    const timeoutId = setTimeout(() => {
      setCompressing(false);
      setLoading(false);
      toast.error(t('toast.timeout'));
    }, 35000);

    // ── Step 1: 圧縮（画像を圧縮中…） ────────────────────────────────────
    let base64ToSend = imageBase64;
    try {
      let compressed;
      if (imageEnhancedDataUrl) {
        // エンハンス済み画像がある場合はそちらを圧縮
        compressed = await compressDataUrl(imageEnhancedDataUrl);
      } else if (imageFileRef.current) {
        // 元ファイルがある場合は EXIF 回転を補正しながら圧縮
        compressed = await compressImage(imageFileRef.current);
      } else {
        // フォールバック: base64 文字列から圧縮
        compressed = await compressDataUrl(`data:${mimeType};base64,${imageBase64}`);
      }
      base64ToSend = compressed.base64;
    } catch {
      // 圧縮失敗時はオリジナルで続行
    } finally {
      setCompressing(false);
    }

    // ── Step 2: AI 解析（AIが解析中…） ─────────────────────────────────
    try {
      const res = await fetch('/api/analyze-foreign-matter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64ToSend,
          mediaType: 'image/jpeg',
          userHint: userHint.trim() || undefined,
          lang: getStoredLang(),
        }),
        signal: AbortSignal.timeout(30000),
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (res.status === 429) {
        setShowLimitModal(true)
        setLoading(false)
        return
      }

      if (!res.ok || data.error) {
        toast.error(data.error ?? t('toast.analysisFailed'));
        setLoading(false);
        return;
      }

      if (data.remaining !== undefined) setUsageRemaining(data.remaining)

      const analysisMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        imageAnalysis: data,
        // テキスト結果から構造化データを生成してエージェントボタンを有効化
        analysis: parseImageAnalysisToAnalysis(data.result ?? '', getStoredLang() === 'en'),
        imageUrl: imageUrl ?? undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, analysisMsg]);
      setShowPanel(false);
      setImageBase64(null);
      setImageUrl(null);
      setImageOriginalDataUrl(null);
      setImageEnhancedDataUrl(null);
      imageFileRef.current = null;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error(t('toast.timeout'));
      } else {
        toast.error(t('toast.networkError'));
      }
    } finally {
      setLoading(false);
    }
  }, [imageBase64, imageUrl, mimeType, userHint, imageEnhancedDataUrl])

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if ([...e.dataTransfer.items].some(i => i.kind === 'file')) setIsDragOver(true)
  }, [])

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handlePageDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragOver(false) }
  }, [])

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleImage(file)
  }, [handleImage])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content && !imageBase64) return
    if (loading) return

    const isFirstMessage = chatHistoryRef.current.length === 0
    const userText = content || '異物の写真を解析してください。写真から確認できる物理的な特徴をすべて説明し、推定される異物種別と緊急度、即時対応アドバイスをお願いします。'

    // ユーザーメッセージを追加
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: isFirstMessage && imageBase64 ? '' : content,
      imageUrl: isFirstMessage && imageBase64 ? imageUrl ?? undefined : undefined,
      timestamp: new Date(),
    }

    // 画像がある最初のメッセージは imageUrl を表示し content は空にしない
    if (isFirstMessage && imageBase64 && content) {
      userMsg.content = content
    } else if (isFirstMessage && imageBase64) {
      userMsg.content = ''
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // チャット履歴に追加
    chatHistoryRef.current.push({ role: 'user', content: userText })

    // 初回メッセージに画像がある場合は圧縮してから送る
    let finalImageBase64 = isFirstMessage ? imageBase64 : undefined
    let finalMimeType = mimeType
    if (finalImageBase64) {
      try {
        let compressed
        if (imageEnhancedDataUrl) {
          compressed = await compressDataUrl(imageEnhancedDataUrl)
        } else if (imageFileRef.current) {
          compressed = await compressImage(imageFileRef.current)
        } else {
          compressed = await compressDataUrl(`data:${mimeType};base64,${finalImageBase64}`)
        }
        finalImageBase64 = compressed.base64
        finalMimeType = compressed.mimeType
      } catch {
        // 圧縮失敗時はオリジナルで続行
      }
    }

    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistoryRef.current,
          imageBase64: finalImageBase64,
          mimeType: finalMimeType,
          userHint: isFirstMessage && userHint.trim() ? userHint.trim() : undefined,
          lang: getStoredLang(),
        }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setShowLimitModal(true)
        setLoading(false)
        return
      }

      if (!res.ok || data.error) {
        toast.error(data.error ?? t('toast.aiFailed'))
        setLoading(false)
        return
      }

      if (data.remaining !== undefined) setUsageRemaining(data.remaining)

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message ?? '',
        analysis: data.analysis ?? undefined,
        quickReplies: data.quickReplies ?? [],
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMsg])
      chatHistoryRef.current.push({ role: 'assistant', content: data.message ?? '' })

      // 最初の解析後、画像は保持しつつ新規メッセージでは送らない
      if (isFirstMessage) {
        setImageBase64(null)
        setImageOriginalDataUrl(null)
        setImageEnhancedDataUrl(null)
      }
    } catch {
      toast.error(t('toast.networkError'))
    } finally {
      setLoading(false)
    }
  }, [input, imageBase64, imageUrl, mimeType, loading, userHint, imageEnhancedDataUrl])

  const handleQuickReply = useCallback((text: string) => {
    sendMessage(text)
  }, [sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const saveAsIncident = useCallback(async () => {
    const lang = getStoredLang();
    const isEn = lang === 'en';
    const dateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'ja-JP');

    // AI解析結果を最優先で探す
    let resultContent = '';
    let resultTitle = '';

    const aiAnalysisMsg = messages.find((m) => m.role === 'assistant' && m.analysis);
    if (aiAnalysisMsg && aiAnalysisMsg.analysis) {
      const analysis = aiAnalysisMsg.analysis;
      const topCandidate = analysis.candidates[0];
      const urgencyLabel = isEn
        ? (analysis.urgency === 'high' ? 'High' : analysis.urgency === 'medium' ? 'Medium' : 'Low')
        : (analysis.urgency === 'high' ? '高' : analysis.urgency === 'medium' ? '中' : '低');
      resultTitle = isEn
        ? `AI Analysis: ${topCandidate?.name ?? 'Foreign Matter Incident'} — ${dateStr}`
        : `AI解析: ${topCandidate?.name ?? '異物混入事故'} — ${dateStr}`;
      resultContent = isEn
        ? [
            `[AI Analysis Result]`,
            `Estimated Foreign Matter: ${topCandidate?.name ?? 'Unknown'} (${topCandidate?.probability ?? 0}%)`,
            `Urgency: ${urgencyLabel}`,
            `Visual Features: ${analysis.visualFeatures.join(', ')}`,
            '',
            `[AI Chat History]`,
            ...messages.filter((m) => m.role !== 'assistant' || !m.analysis).slice(0, 5).map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`),
          ].join('\n')
        : [
            `【AI解析結果】`,
            `推定異物：${topCandidate?.name ?? '不明'} (${topCandidate?.probability ?? 0}%)`,
            `緊急度：${urgencyLabel}`,
            `目視特徴：${analysis.visualFeatures.join('、')}`,
            '',
            `【AI対話内容】`,
            ...messages.filter((m) => m.role !== 'assistant' || !m.analysis).slice(0, 5).map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`),
          ].join('\n');
    } else if (messages.some((m) => m.imageAnalysis)) {
      // 画像解析結果を保存
      const imageMsg = messages.find((m) => m.imageAnalysis);
      if (imageMsg?.imageAnalysis) {
        resultTitle = isEn
          ? `Image Analysis: Foreign Matter Result — ${dateStr}`
          : `画像解析: 異物特定結果 — ${dateStr}`;
        resultContent = isEn
          ? [
              `[Image Analysis Result]`,
              imageMsg.imageAnalysis.result,
              '',
              `[Chat History]`,
              ...messages.filter((m) => m.role === 'user').map((m) => `Q: ${m.content}`),
            ].join('\n')
          : [
              `【画像解析結果】`,
              imageMsg.imageAnalysis.result,
              '',
              `【対話情報】`,
              ...messages.filter((m) => m.role === 'user').map((m) => `Q: ${m.content}`),
            ].join('\n');
      }
    } else if (messages.some((m) => m.searchResult)) {
      // Claude検索結果を保存
      const searchMsg = messages.find((m) => m.searchResult);
      if (searchMsg?.searchResult) {
        resultTitle = isEn
          ? `AI Search: Foreign Matter Info — ${dateStr}`
          : `AI検索: 異物・害虫情報 — ${dateStr}`;
        resultContent = isEn
          ? [
              `[AI Search Result]`,
              searchMsg.searchResult.result,
              '',
              `[Search Queries]`,
              ...messages.filter((m) => m.role === 'user').map((m) => `Q: ${m.content}`),
            ].join('\n')
          : [
              `【AI検索結果】`,
              searchMsg.searchResult.result,
              '',
              `【検索クエリ】`,
              ...messages.filter((m) => m.role === 'user').map((m) => `Q: ${m.content}`),
            ].join('\n');
      }
    }

    if (!resultContent) {
      toast.error(t('toast.aiSaveEmpty'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/claude-save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: resultTitle,
          location: isEn ? '(Recorded from AI chat)' : '（AI対話から記録）',
          description: resultContent,
          status: 'open',
          lang,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success(t('toast.aiSaved'));
    } catch {
      toast.error(t('toast.aiSaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [messages]);

  const resetChat = useCallback(() => {
    chatHistoryRef.current = []
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: t('aichat.resetMsg'),
      quickReplies: [],
      timestamp: new Date(),
    }])
    setImageBase64(null)
    setImageUrl(null)
    setImageOriginalDataUrl(null)
    setImageEnhancedDataUrl(null)
    setVisualizerDataUrl(null)
    setShowVisualizer(false)
    setInput('')
  }, [t])

  const hasAnalysis = messages.some((m) => m.analysis || m.searchResult || m.imageAnalysis)

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-gray-50 relative"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 shadow-sm px-4 pt-safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-14">
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
              <span className="text-xl">🔬</span>
              {t('aichat.title')}
            </h1>
            <p className="text-[10px] text-gray-400 leading-none">{t('aichat.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasAnalysis && (
              <>
                {visualizerDataUrl && (
                  <button
                    onClick={() => setShowVisualizer(true)}
                    className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg font-medium active:scale-95 transition-all shadow-sm"
                    title={t('aichat.vizOpen')}
                  >
                    🔬
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="text-xs px-3 py-1.5 bg-gray-500 text-white rounded-lg font-medium active:scale-95 transition-all shadow-sm"
                >
                  {t('report.print')}
                </button>
              </>
            )}
            <button
              onClick={resetChat}
              className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium active:scale-95 transition-all"
            >
              {t('aichat.reset')}
            </button>
          </div>
        </div>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-40 max-w-2xl w-full mx-auto">
        {/* メッセージ一覧 */}
        {messages.map((msg, idx) => {
          const isLastAnalysis = msg.imageAnalysis != null &&
            messages.slice(idx + 1).every(m => !m.imageAnalysis)
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onQuickReply={handleQuickReply}
              analysisRef={isLastAnalysis ? lastAnalysisRef : undefined}
              onStartAgent={(a) => { setAgentAnalysis(a); setAgentPanelOpen(true) }}
            />
          )
        })}

        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ドロップオーバーレイ */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-orange-500/20 border-4 border-dashed border-orange-400 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-2">
            <span className="text-4xl">📷</span>
            <span className="text-base font-bold text-orange-600">ここにドロップ</span>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-100 max-w-2xl w-full mx-auto pb-16">

        {/* パネルトグルバー */}
        <button
          onClick={() => setShowPanel(v => !v)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600 active:bg-gray-50 transition-colors"
        >
          {showPanel ? t('aichat.panelClose') : t('aichat.panelOpen')}
        </button>

        {/* 折りたたみパネル */}
        {showPanel && (
          <div className="px-3 pb-2 space-y-2 border-t border-gray-100 max-h-[40vh] overflow-y-auto">
            {/* Claude 検索 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden mt-2">
              <div className="px-3 py-2 space-y-2">
                <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
                  <span>🔍</span> {t('aichat.searchLabel')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleClaudeSearch()}
                    placeholder={t('aichat.searchPlaceholder')}
                    className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    disabled={searchLoading}
                  />
                  <button
                    onClick={handleClaudeSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {searchLoading ? t('aichat.searching') : t('aichat.searchBtn')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setSearchQuery(suggestion)}
                      className="text-[10px] px-2 py-0.5 bg-white border border-blue-200 text-blue-600 rounded-full active:scale-95 transition-all font-medium"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 写真エリア */}
            {!imageUrl ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/60 flex flex-col items-center justify-center gap-1 active:bg-orange-100 transition-colors"
              >
                <span className="text-2xl">📷</span>
                <span className="text-xs text-orange-500 font-medium">{t('aichat.photoAddDrop')}</span>
              </button>
            ) : (
              <div className="p-3 bg-white rounded-xl border-2 border-orange-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                    <span>📸</span> {t('aichat.photoReady')}
                  </p>
                  <button
                    onClick={() => { setImageUrl(null); setImageBase64(null); setImageOriginalDataUrl(null); setImageEnhancedDataUrl(null) }}
                    className="text-[10px] text-gray-400 hover:text-red-400"
                  >
                    {t('aichat.deletePhoto')}
                  </button>
                </div>
                {imageOriginalDataUrl && (
                  <ImageEnhancer imageDataUrl={imageOriginalDataUrl} onEnhanced={handleEnhanced} />
                )}
                {imageOriginalDataUrl && (
                  <ComparisonPanel originalDataUrl={imageOriginalDataUrl} enhancedDataUrl={imageEnhancedDataUrl} />
                )}
                <div className="mb-2">
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                    {t('aichat.hintLabel')}
                  </label>
                  <input
                    type="text"
                    value={userHint}
                    onChange={e => setUserHint(e.target.value)}
                    placeholder={t('aichat.hintPlaceholder')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-orange-200 bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:bg-white transition-all placeholder:text-gray-300"
                  />
                </div>
                <button
                  onClick={handleImageUploadAnalysis}
                  disabled={loading || compressing}
                  className="w-full px-3 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {compressing ? t('aichat.compressing') : loading ? t('aichat.analyzing') : t('aichat.analyzeBtn')}
                </button>
                {usageRemaining !== null && (
                  <p className="text-[10px] text-gray-400 text-center mt-1">
                    {t('aichat.usageLeft').replace('{n}', String(usageRemaining))}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 保存ボタン（解析結果あり時のみ表示） */}
        {hasAnalysis && (
          <div className="px-3 pb-1.5">
            <button
              onClick={saveAsIncident}
              disabled={saving}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-1.5"
            >
              {saving ? t('common.saving') : t('aichat.save')}
            </button>
          </div>
        )}
        {/* 入力行 */}
        <div className="flex gap-2 items-end px-3 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
          {!imageUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 shrink-0 flex items-center justify-center bg-orange-50 border border-orange-200 rounded-xl text-lg active:scale-95 transition-all"
              title={t('aichat.photoAddTitle')}
            >
              📷
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={compressing ? t('aichat.compressing') : imageBase64 ? t('aichat.inputWithPhoto') : loading ? t('aichat.analyzing') : t('aichat.inputPlaceholder')}
            disabled={loading || compressing}
            rows={1}
            className="flex-1 resize-none bg-gray-100 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:bg-white transition-all max-h-28 overflow-y-auto leading-relaxed disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || (!input.trim() && !imageBase64)}
            className="w-10 h-10 shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white text-lg shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : '↑'}
          </button>
        </div>

        {/* 注意書き */}
        <p className="text-[9px] text-gray-400 text-center pb-2 leading-tight px-3">
          {t('disclaimer')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <Navigation />

      {/* 使用制限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-5xl text-center">🔒</div>
            <h2 className="text-base font-bold text-center text-gray-800">{t('aichat.limitTitle')}</h2>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {t('aichat.limitDesc1')}<br />
              {t('aichat.limitDesc2')}<br />
              <span className="font-bold text-orange-600">@hapifoodlab</span> {t('aichat.limitDesc3')}
            </p>
            <div className="flex gap-2">
              <a
                href="https://x.com/hapifoodlab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 text-center text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors"
              >
                {t('aichat.limitFollow')}
              </a>
              <a
                href="https://note.com/hapifoodlab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 text-center text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
              >
                📝 note
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowLimitModal(false)}
              className="block w-full py-2 text-center text-sm text-gray-400 hover:text-gray-600"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {/* Agent panel */}
      {agentPanelOpen && agentAnalysis && (
        <AgentPanel
          analysis={agentAnalysis}
          lang={lang}
          userHint={userHint}
          onClose={() => setAgentPanelOpen(false)}
        />
      )}

      {/* Forensic visualizer modal */}
      {showVisualizer && visualizerDataUrl && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 flex items-start justify-center overflow-y-auto p-3"
          onClick={e => { if (e.target === e.currentTarget) setShowVisualizer(false) }}
        >
          <div className="w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-950 rounded-t-2xl border border-b-0 border-gray-700">
              <span className="text-xs font-bold text-[#6dd39b] font-mono tracking-wider">{t('aichat.vizTitle')}</span>
              <button
                onClick={() => setShowVisualizer(false)}
                className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded transition-colors"
              >
                {t('aichat.vizClose')}
              </button>
            </div>
            <ForeignMatterVisualizer imageDataUrl={visualizerDataUrl} />
          </div>
        </div>
      )}
    </div>
  )
}
