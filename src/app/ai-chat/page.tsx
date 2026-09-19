'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import { useLang } from '@/context/LanguageContext'
import ImageEnhancer from '@/components/ImageEnhancer'
import ForeignMatterVisualizer from '@/components/ForeignMatterVisualizer'
import ComparisonPanel from '@/components/ComparisonPanel'
import toast from 'react-hot-toast'

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

function MessageBubble({ msg, onQuickReply }: { msg: Message; onQuickReply: (text: string) => void }) {
  const { t } = useLang()
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
      <div className={`max-w-[85%] ${isAI ? '' : ''}`}>
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
        {msg.analysis && <AnalysisCard analysis={msg.analysis} urgencyLabels={urgencyLabels} candidatesLabel={t('aichat.candidates')} visualLabel={t('aichat.visualFeatures')} />}

        {/* Claude 検索結果 */}
        {msg.searchResult && (
          <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-2">{t('aichat.searchResult')}</p>
            <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
              {msg.searchResult.result}
            </div>
          </div>
        )}

        {/* 画像解析結果 */}
        {msg.imageAnalysis && (
          <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide mb-2">{t('aichat.imageAnalysis')}</p>
            <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
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

export default function AiChatPage() {
  const { t } = useLang()
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null)
  const [userHint, setUserHint] = useState('')
  const [showLimitModal, setShowLimitModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const QUICK_SUGGESTIONS = [
    '虫類', '金属片', '針金・金属線', 'プラスチック片', 'ゴム片',
    'ガラス片', '毛髪・体毛', '骨片', '木片・紙片', '種・核', '植物片',
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, searchLoading])

  // 初回ウェルカムメッセージ
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t('aichat.welcome'),
      quickReplies: [],
      timestamp: new Date(),
    }])
  }, [])

  const handleImage = useCallback((file: File) => {
    // ファイルサイズチェック（5MB以下）
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('toast.imageSize') + ` (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('toast.imageFormat'));
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
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
        body: JSON.stringify({ query }),
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

  const handleImageUploadAnalysis = useCallback(async (file: File) => {
    if (!imageBase64) return;
    
    setLoading(true);
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast.error(t('toast.timeout'));
    }, 35000); // 35秒後にタイムアウト

    try {
      const res = await fetch('/api/analyze-foreign-matter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mediaType: mimeType,
          userHint: userHint.trim() || undefined,
        }),
        signal: AbortSignal.timeout(30000), // 30秒でAPI呼び出しをキャンセル
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
        content: data.result ?? '',
        imageAnalysis: data,
        imageUrl: imageUrl ?? undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, analysisMsg]);
      setImageBase64(null);
      setImageUrl(null);
      setImageOriginalDataUrl(null);
      setImageEnhancedDataUrl(null);
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
  }, [imageBase64, imageUrl, mimeType, userHint])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
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

    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistoryRef.current,
          imageBase64: isFirstMessage ? imageBase64 : undefined,
          mimeType,
          userHint: isFirstMessage && userHint.trim() ? userHint.trim() : undefined,
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
  }, [input, imageBase64, imageUrl, mimeType, loading, userHint])

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
    // AI解析結果を最優先で探す
    let resultContent = '';
    let resultTitle = '';
    
    const aiAnalysisMsg = messages.find((m) => m.role === 'assistant' && m.analysis);
    if (aiAnalysisMsg && aiAnalysisMsg.analysis) {
      const analysis = aiAnalysisMsg.analysis;
      const topCandidate = analysis.candidates[0];
      resultTitle = `AI解析: ${topCandidate?.name ?? '異物混入事故'} — ${new Date().toLocaleDateString('ja-JP')}`;
      resultContent = [
        `【AI解析結果】`,
        `推定異物：${topCandidate?.name ?? '不明'} (${topCandidate?.probability ?? 0}%)`,
        `緊急度：${analysis.urgency === 'high' ? '高' : analysis.urgency === 'medium' ? '中' : '低'}`,
        `目視特徴：${analysis.visualFeatures.join('、')}`,
        '',
        `【AI対話内容】`,
        ...messages
          .filter((m) => m.role !== 'assistant' || !m.analysis)
          .slice(0, 5)
          .map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`),
      ].join('\n');
    } else if (messages.some((m) => m.imageAnalysis)) {
      // 画像解析結果を保存
      const imageMsg = messages.find((m) => m.imageAnalysis);
      if (imageMsg?.imageAnalysis) {
        resultTitle = `画像解析: 異物特定結果 — ${new Date().toLocaleDateString('ja-JP')}`;
        resultContent = [
          `【画像解析結果】`,
          imageMsg.imageAnalysis.result,
          '',
          `【対話情報】`,
          ...messages
            .filter((m) => m.role === 'user')
            .map((m) => `Q: ${m.content}`),
        ].join('\n');
      }
    } else if (messages.some((m) => m.searchResult)) {
      // Claude検索結果を保存
      const searchMsg = messages.find((m) => m.searchResult);
      if (searchMsg?.searchResult) {
        resultTitle = `Claude検索: 異物・害虫情報 — ${new Date().toLocaleDateString('ja-JP')}`;
        resultContent = [
          `【Claude検索結果】`,
          searchMsg.searchResult.result,
          '',
          `【検索クエリ】`,
          ...messages
            .filter((m) => m.role === 'user')
            .map((m) => `Q: ${m.content}`),
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
          location: '（AI対話から記録）',
          description: resultContent,
          status: 'open',
          source: 'ai_chat',
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
  const isFirstUserTurn = chatHistoryRef.current.length === 0

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
                    title="異物ビジュアライザーで開く"
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
                <button
                  onClick={saveAsIncident}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg font-medium active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                >
                  {saving ? t('common.saving') : t('aichat.save')}
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
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-2 max-w-2xl w-full mx-auto">
        {/* メッセージ一覧 */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onQuickReply={handleQuickReply} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-100 px-3 pt-2 pb-[calc(theme(spacing.16)+env(safe-area-inset-bottom,0px)+8px)] max-w-2xl w-full mx-auto space-y-3">
        {/* Claude 検索セクション */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700">{t('aichat.searchSection')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleClaudeSearch()}
              placeholder="キーワードを入力..."
              className="flex-1 bg-white rounded-lg px-3 py-2 text-xs border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              disabled={searchLoading}
            />
            <button
              onClick={handleClaudeSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="px-3 py-2 bg-blue-500 text-white text-xs font-medium rounded-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchLoading ? t('aichat.searching') : t('aichat.searchBtn')}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setSearchQuery(suggestion)
                }}
                className="text-[10px] px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded-full hover:bg-blue-50 active:scale-95 transition-all font-medium"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* 画像解析セクション */}
        {!imageBase64 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-orange-200 rounded-2xl p-5 flex flex-col items-center gap-2 bg-orange-50/50 active:bg-orange-50 cursor-pointer transition-colors"
          >
            <span className="text-3xl">📷</span>
            <p className="text-sm font-semibold text-orange-600">{t('aichat.addPhoto')}</p>
            <p className="text-xs text-gray-400">{t('aichat.tapOrDrop')}</p>
          </div>
        )}

        {imageUrl && (
          <div className="p-3 bg-white rounded-2xl border-2 border-orange-200 shadow-sm">
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
              <ImageEnhancer
                imageDataUrl={imageOriginalDataUrl}
                onEnhanced={handleEnhanced}
              />
            )}
            {imageOriginalDataUrl && (
              <ComparisonPanel
                originalDataUrl={imageOriginalDataUrl}
                enhancedDataUrl={imageEnhancedDataUrl}
              />
            )}
            {/* 心当たり入力欄 */}
            <div className="mb-2">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                💡 異物の心当たり（任意）
              </label>
              <input
                type="text"
                value={userHint}
                onChange={e => setUserHint(e.target.value)}
                placeholder="例：赤いパレットの破片の可能性あり"
                className="w-full text-xs px-3 py-2 rounded-xl border border-orange-200 bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>
            <button
              onClick={() => handleImageUploadAnalysis(new File([imageBase64!], 'image.jpg', { type: mimeType }))}
              disabled={loading}
              className="w-full px-3 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('aichat.analyzing') : t('aichat.analyzeBtn')}
            </button>
            {usageRemaining !== null && (
              <p className="text-[10px] text-gray-400 text-center mt-1">
                今月残り {usageRemaining} 回（無料枠）
              </p>
            )}
          </div>
        )}

        {/* 従来の入力エリア */}

        {/* 従来の入力エリア */}
        <div className="flex gap-2 items-end">
          {/* 写真ボタン（会話中） */}
          {(!isFirstUserTurn || imageBase64) && !imageUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 shrink-0 flex items-center justify-center bg-orange-50 border border-orange-200 rounded-xl text-lg active:scale-95 transition-all"
              title="写真を追加"
            >
              📷
            </button>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={imageBase64 ? t('aichat.inputWithPhoto') : loading ? t('aichat.analyzing') : t('aichat.inputPlaceholder')}
            disabled={loading}
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
        <p className="text-[9px] text-gray-400 text-center mt-1.5 leading-tight">
          {t('disclaimer')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <Navigation />

      {/* 使用制限モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-5xl text-center">🔒</div>
            <h2 className="text-base font-bold text-center text-gray-800">今月の無料解析上限に達しました</h2>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              無料プランは月3回まで利用できます。<br />
              お問い合わせはXまたはnoteの<br />
              <span className="font-bold text-orange-600">@hapifoodlab</span> までご連絡ください。
            </p>
            <div className="flex gap-2">
              <a
                href="https://x.com/hapifoodlab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 text-center text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors"
              >
                𝕏 フォロー・DM
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
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Forensic visualizer modal */}
      {showVisualizer && visualizerDataUrl && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 flex items-start justify-center overflow-y-auto p-3"
          onClick={e => { if (e.target === e.currentTarget) setShowVisualizer(false) }}
        >
          <div className="w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-950 rounded-t-2xl border border-b-0 border-gray-700">
              <span className="text-xs font-bold text-[#6dd39b] font-mono tracking-wider">🔬 異物ビジュアライザー</span>
              <button
                onClick={() => setShowVisualizer(false)}
                className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded transition-colors"
              >
                ✕ 閉じる
              </button>
            </div>
            <ForeignMatterVisualizer imageDataUrl={visualizerDataUrl} />
          </div>
        </div>
      )}
    </div>
  )
}
