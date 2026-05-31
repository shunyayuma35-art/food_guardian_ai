import { NextResponse } from 'next/server'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { createBackupSync, listBackupsSync, getBackupDir } from '@/lib/backup-util'

export async function GET() {
  try {
    const backupDir = getBackupDir()
    const backups = listBackupsSync().map((name) => {
      const dir = join(backupDir, name)
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []
      return { name, files }
    })
    return NextResponse.json(backups)
  } catch (err) {
    console.error('[GET /api/backup]', err)
    return NextResponse.json({ error: 'バックアップ一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = createBackupSync()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/backup]', err)
    return NextResponse.json({ error: 'バックアップに失敗しました' }, { status: 500 })
  }
}
