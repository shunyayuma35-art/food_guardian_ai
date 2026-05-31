/**
 * 全クライアントページで使う安全なfetchラッパー
 * - HTTPエラーを例外として扱う
 * - タイムアウト対応（デフォルト15秒）
 * - AbortControllerによるキャンセル対応
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number },
  signal?: AbortSignal
): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options ?? {}

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // 外部のAbortSignalが渡された場合も対応
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers ?? {}),
      },
    })

    clearTimeout(timer)

    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json()).error ?? '' } catch { /* ignore */ }
      throw new Error(detail || `サーバーエラー (${res.status})`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new Error('通信タイムアウト。ネットワークを確認してください。')
    }
    throw err
  }
}
