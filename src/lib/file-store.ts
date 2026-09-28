/**
 * 汎用JSONファイルストア（全APIルートで共用）
 * - アトミック書き込み（tmp→rename）
 * - ファイルロックで競合防止
 * - 破損データを安全にリカバリ
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { withFileLock } from './file-lock'

const DATA_DIR = join(process.cwd(), 'data')

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  } catch {
    // Cloud Run: read-only filesystem — silently ignore so reads return []
  }
}

function filePath(name: string) {
  return join(DATA_DIR, `${name}.json`)
}

export function readStore<T>(name: string): T[] {
  ensureDir()
  const file = filePath(name)
  if (!existsSync(file)) return []
  try {
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error(`[file-store] readStore(${name}) parse error:`, err)
    return []
  }
}

export async function writeStore<T>(name: string, items: T[]): Promise<void> {
  await withFileLock(name, async () => {
    ensureDir()
    const file = filePath(name)
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8')
    renameSync(tmp, file)
  })
}

export async function upsertItem<T extends { id: string }>(
  name: string,
  item: T
): Promise<void> {
  await withFileLock(name, async () => {
    const items = readStore<T>(name)
    const idx = items.findIndex((i) => i.id === item.id)
    if (idx >= 0) items[idx] = item
    else items.unshift(item)
    const file = filePath(name)
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8')
    renameSync(tmp, file)
  })
}

export async function updateItem<T extends { id: string }>(
  name: string,
  id: string,
  patch: Partial<T>
): Promise<boolean> {
  let found = false
  await withFileLock(name, async () => {
    const items = readStore<T>(name)
    const idx = items.findIndex((i) => i.id === id)
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() } as T
      found = true
      const file = filePath(name)
      const tmp = file + '.tmp'
      writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8')
      renameSync(tmp, file)
    }
  })
  return found
}

export async function deleteItem<T extends { id: string }>(
  name: string,
  id: string
): Promise<void> {
  await withFileLock(name, async () => {
    const items = readStore<T>(name)
    const filtered = items.filter((i) => i.id !== id)
    const file = filePath(name)
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(filtered, null, 2), 'utf-8')
    renameSync(tmp, file)
  })
}
