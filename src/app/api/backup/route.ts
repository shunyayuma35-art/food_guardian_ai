import { NextResponse } from 'next/server'
import { listBackupsSync, getBackupDir } from '@/lib/backup-util'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

// Cloud Run ではローカルファイルシステムへの書き込みができないため、
// POST は何もせず 200 OK を返す。データは Supabase / Firebase に保存済み。
export async function POST() {
  return NextResponse.json({
    ok: true,
    storage: 'cloud',
    notice: 'データは Supabase / Firebase に自動保存されています。ローカルバックアップは不要です。',
  })
}

// ローカルバックアップ一覧を返す。
// Cloud Run では書き込み不可のため常に空配列になる。
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
    return NextResponse.json([])
  }
}
