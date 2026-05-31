/**
 * ファイル書き込みの競合防止（Node.js シングルスレッドを活用したシンプルなミューテックス）
 * 複数リクエストが同時にJSONファイルを読み書きしてもデータ破損しない
 */
const locks = new Map<string, Promise<void>>()

export async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve()
  let resolve!: () => void
  const next = new Promise<void>((res) => { resolve = res })
  locks.set(key, next)
  try {
    await prev
    return await fn()
  } finally {
    resolve()
    if (locks.get(key) === next) locks.delete(key)
  }
}
