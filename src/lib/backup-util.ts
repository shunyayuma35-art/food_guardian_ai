import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const BACKUP_DIR = join(DATA_DIR, 'backups')
const MAX_BACKUPS = 30

function pad(n: number) { return String(n).padStart(2, '0') }

function nowLabel() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

export function listBackupsSync(): string[] {
  if (!existsSync(BACKUP_DIR)) return []
  return readdirSync(BACKUP_DIR)
    .filter((name) => statSync(join(BACKUP_DIR, name)).isDirectory())
    .sort()
    .reverse()
}

export function createBackupSync(): { name: string; files: string[] } {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

  const label = nowLabel()
  const destDir = join(BACKUP_DIR, label)
  mkdirSync(destDir, { recursive: true })

  const copied: string[] = []
  readdirSync(DATA_DIR).forEach((file) => {
    if (!file.endsWith('.json') || file.endsWith('.tmp')) return
    const src = join(DATA_DIR, file)
    if (statSync(src).isFile()) {
      copyFileSync(src, join(destDir, file))
      copied.push(file)
    }
  })

  // 古いバックアップを削除
  listBackupsSync().slice(MAX_BACKUPS).forEach((name) => {
    rmSync(join(BACKUP_DIR, name), { recursive: true, force: true })
  })

  return { name: label, files: copied }
}

export function getBackupDir() { return BACKUP_DIR }
export function getDataDir() { return DATA_DIR }
