import { NextRequest, NextResponse } from 'next/server'
import { existsSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createBackupSync, getBackupDir, getDataDir } from '@/lib/backup-util'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name } = body as { name?: string }

    if (!name || typeof name !== 'string' || name.includes('..') || /[/\\]/.test(name)) {
      return NextResponse.json({ error: '無効なバックアップ名です' }, { status: 400 })
    }

    const backupDir = getBackupDir()
    const dataDir = getDataDir()
    const srcDir = join(backupDir, name)

    if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
      return NextResponse.json({ error: 'バックアップが見つかりません' }, { status: 404 })
    }

    // 復元前に現在のデータを自動バックアップ
    try { createBackupSync() } catch (e) {
      console.warn('[restore] pre-restore backup failed:', e)
    }

    // JSONファイルのみを安全に復元
    const files = readdirSync(srcDir).filter((f) => {
      const fp = join(srcDir, f)
      return f.endsWith('.json') && !f.endsWith('.tmp') && statSync(fp).isFile()
    })

    const restored: string[] = []
    files.forEach((file) => {
      copyFileSync(join(srcDir, file), join(dataDir, file))
      restored.push(file)
    })

    return NextResponse.json({ restored, from: name })
  } catch (err) {
    console.error('[POST /api/backup/restore]', err)
    return NextResponse.json({ error: '復元に失敗しました' }, { status: 500 })
  }
}
