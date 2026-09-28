import type { Incident, SensoryEvaluation, Report, InspectionRecord } from './types'
import { v4 as uuidv4 } from 'uuid'
import { DEMO_MODE, app } from './firebase'

// ── localStorage ヘルパー（DEMO_MODE / Vercel デモ用） ────────────

function localGet<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

function localSet<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('ストレージ容量が不足しています。古い記録を削除してください。')
    }
    throw e
  }
}

// ── Firebase Firestore ヘルパー ───────────────────────────────────

async function getDB() {
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app!)
}

async function fbAdd(col: string, data: Record<string, unknown>) {
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
  const db = await getDB()
  const ref = await addDoc(collection(db, col), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

async function fbGet(col: string, id: string) {
  const { doc, getDoc } = await import('firebase/firestore')
  const db = await getDB()
  const snap = await getDoc(doc(db, col, id))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    ...d, id: snap.id,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt ?? '',
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? d.updatedAt ?? '',
  }
}

async function fbList(col: string, userId?: string) {
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore')
  const db = await getDB()
  const q = userId
    ? query(collection(db, col), where('createdBy', '==', userId), orderBy('createdAt', 'desc'))
    : query(collection(db, col), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data, id: d.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt ?? '',
    }
  })
}

async function fbUpdate(col: string, id: string, data: Record<string, unknown>) {
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  const db = await getDB()
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() })
}

async function fbDelete(col: string, id: string) {
  const { doc, deleteDoc } = await import('firebase/firestore')
  const db = await getDB()
  await deleteDoc(doc(db, col, id))
}

// ── 異物事故 ─────────────────────────────────────────────────────

const INC_KEY = 'fe_incidents'

export async function createIncident(
  data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const list = localGet<Incident>(INC_KEY)
    list.unshift({ ...data, id, createdAt: now, updatedAt: now })
    localSet(INC_KEY, list)
    return id
  }
  return fbAdd('incidents', { ...data, id })
}

export async function getIncident(id: string): Promise<Incident | null> {
  if (DEMO_MODE) return localGet<Incident>(INC_KEY).find((i) => i.id === id) ?? null
  return fbGet('incidents', id) as Promise<Incident | null>
}

export async function updateIncident(id: string, data: Partial<Incident>): Promise<void> {
  if (DEMO_MODE) {
    const list = localGet<Incident>(INC_KEY)
    const idx = list.findIndex((i) => i.id === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() }
    localSet(INC_KEY, list)
    return
  }
  await fbUpdate('incidents', id, data as Record<string, unknown>)
}

export async function listIncidents(userId?: string): Promise<Incident[]> {
  if (DEMO_MODE) {
    const list = localGet<Incident>(INC_KEY)
    return userId ? list.filter((i) => i.createdBy === userId) : list
  }
  return fbList('incidents', userId) as Promise<Incident[]>
}

export async function deleteIncident(id: string): Promise<void> {
  if (DEMO_MODE) { localSet(INC_KEY, localGet<Incident>(INC_KEY).filter((i) => i.id !== id)); return }
  await fbDelete('incidents', id)
}

export async function findIncidentsByLot(lotNumber: string, userId?: string): Promise<Incident[]> {
  if (DEMO_MODE) {
    const list = localGet<Incident>(INC_KEY)
    const s = userId ? list.filter((i) => i.createdBy === userId) : list
    return s.filter((i) => i.lotNumber === lotNumber)
  }
  const { collection, query, where, getDocs } = await import('firebase/firestore')
  const db = await getDB()
  const constraints = [where('lotNumber', '==', lotNumber)]
  if (userId) constraints.push(where('createdBy', '==', userId))
  const snap = await getDocs(query(collection(db, 'incidents'), ...constraints))
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Incident))
}

// ── 検査記録（Supabase / API ルート経由） ──────────────────────────
// 本番: /api/inspections → Supabase（Cloud Run 対応）
// DEMO_MODE: localStorage（デモ・ローカル開発用）

const INSP_KEY = 'fe_inspections'

export async function createInspectionRecord(
  data: Omit<InspectionRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const list = localGet<InspectionRecord>(INSP_KEY)
    list.unshift({ ...data, id, createdAt: now, updatedAt: now })
    localSet(INSP_KEY, list)
    return id
  }

  const record: InspectionRecord = { ...data, id, createdAt: now, updatedAt: now }
  const res = await fetch('/api/inspections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? '検査記録の保存に失敗しました')
  }
  return id
}

export async function listInspections(userId?: string): Promise<InspectionRecord[]> {
  if (DEMO_MODE) {
    const list = localGet<InspectionRecord>(INSP_KEY)
    return userId ? list.filter((i) => i.createdBy === userId) : list
  }
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  const res = await fetch(`/api/inspections${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getInspection(id: string): Promise<InspectionRecord | null> {
  if (DEMO_MODE) return localGet<InspectionRecord>(INSP_KEY).find((i) => i.id === id) ?? null
  const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('データ取得に失敗しました')
  return res.json()
}

export async function updateInspection(id: string, data: Partial<InspectionRecord>): Promise<void> {
  if (DEMO_MODE) {
    const list = localGet<InspectionRecord>(INSP_KEY)
    const idx = list.findIndex((i) => i.id === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() }
    localSet(INSP_KEY, list)
    return
  }
  const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? '更新に失敗しました')
  }
}

export async function deleteInspection(id: string): Promise<void> {
  if (DEMO_MODE) {
    localSet(INSP_KEY, localGet<InspectionRecord>(INSP_KEY).filter((i) => i.id !== id))
    return
  }
  const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? '削除に失敗しました')
  }
}

// ── マスターデータ ────────────────────────────────────────────────

export interface MasterData {
  staff: string[]
  products: string[]
  devices: { name: string; type: 'metal_detector' | 'xray'; line?: string }[]
}

const MASTER_KEY = 'fe_masters'
const MASTER_DOC_ID = 'global'
const EMPTY_MASTER: MasterData = { staff: [], products: [], devices: [] }

export async function getMasters(): Promise<MasterData> {
  if (DEMO_MODE) {
    const list = localGet<MasterData>(MASTER_KEY)
    return list.length > 0 ? list[0] : EMPTY_MASTER
  }
  const { doc, getDoc } = await import('firebase/firestore')
  const db = await getDB()
  const snap = await getDoc(doc(db, 'masters', MASTER_DOC_ID))
  return snap.exists() ? snap.data() as MasterData : EMPTY_MASTER
}

export async function saveMasters(data: MasterData): Promise<void> {
  if (DEMO_MODE) { localSet(MASTER_KEY, [data]); return }
  const { doc, setDoc } = await import('firebase/firestore')
  const db = await getDB()
  await setDoc(doc(db, 'masters', MASTER_DOC_ID), data)
}

// ── 官能検査 ─────────────────────────────────────────────────────

const SENSORY_KEY = 'fe_sensory'

export async function createSensoryEvaluation(
  data: Omit<SensoryEvaluation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const list = localGet<SensoryEvaluation>(SENSORY_KEY)
    list.unshift({ ...data, id, createdAt: now, updatedAt: now })
    localSet(SENSORY_KEY, list)
    return id
  }
  return fbAdd('sensory_evaluations', { ...data, id })
}

export async function getSensoryEvaluation(id: string): Promise<SensoryEvaluation | null> {
  if (DEMO_MODE) return localGet<SensoryEvaluation>(SENSORY_KEY).find((i) => i.id === id) ?? null
  return fbGet('sensory_evaluations', id) as Promise<SensoryEvaluation | null>
}

export async function updateSensoryEvaluation(id: string, data: Partial<SensoryEvaluation>): Promise<void> {
  if (DEMO_MODE) {
    const list = localGet<SensoryEvaluation>(SENSORY_KEY)
    const idx = list.findIndex((i) => i.id === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() }
    localSet(SENSORY_KEY, list)
    return
  }
  await fbUpdate('sensory_evaluations', id, data as Record<string, unknown>)
}

export async function listSensoryEvaluations(userId?: string): Promise<SensoryEvaluation[]> {
  if (DEMO_MODE) {
    const list = localGet<SensoryEvaluation>(SENSORY_KEY)
    return userId ? list.filter((i) => i.createdBy === userId) : list
  }
  return fbList('sensory_evaluations', userId) as Promise<SensoryEvaluation[]>
}

export async function deleteSensoryEvaluation(id: string): Promise<void> {
  if (DEMO_MODE) { localSet(SENSORY_KEY, localGet<SensoryEvaluation>(SENSORY_KEY).filter((i) => i.id !== id)); return }
  await fbDelete('sensory_evaluations', id)
}

// ── 報告書 ───────────────────────────────────────────────────────

const REPORT_KEY = 'fe_reports'

export async function createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const list = localGet<Report>(REPORT_KEY)
    list.unshift({ ...data, id, createdAt: now, updatedAt: now })
    localSet(REPORT_KEY, list)
    return id
  }
  return fbAdd('reports', { ...data, id })
}

export async function getReport(id: string): Promise<Report | null> {
  if (DEMO_MODE) return localGet<Report>(REPORT_KEY).find((i) => i.id === id) ?? null
  return fbGet('reports', id) as Promise<Report | null>
}

export async function updateReport(id: string, data: Partial<Report>): Promise<void> {
  if (DEMO_MODE) {
    const list = localGet<Report>(REPORT_KEY)
    const idx = list.findIndex((i) => i.id === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() }
    localSet(REPORT_KEY, list)
    return
  }
  await fbUpdate('reports', id, data as Record<string, unknown>)
}

export async function listReports(userId?: string): Promise<Report[]> {
  if (DEMO_MODE) {
    const list = localGet<Report>(REPORT_KEY)
    return userId ? list.filter((i) => i.createdBy === userId) : list
  }
  return fbList('reports', userId) as Promise<Report[]>
}

export async function deleteReport(id: string): Promise<void> {
  if (DEMO_MODE) { localSet(REPORT_KEY, localGet<Report>(REPORT_KEY).filter((i) => i.id !== id)); return }
  await fbDelete('reports', id)
}
