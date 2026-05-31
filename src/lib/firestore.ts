import type { Incident, SensoryEvaluation, Report, InspectionRecord } from './types'
import { v4 as uuidv4 } from 'uuid'
import { safeFetch } from './safe-fetch'
import { DEMO_MODE, app } from './firebase'

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
    ...d,
    id: snap.id,
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
      ...data,
      id: d.id,
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

// ── ローカルAPIフォールバック ─────────────────────────────────────

function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  return safeFetch<T>(url, options)
}

// ── 異物事故 ─────────────────────────────────────────────────────

export async function createIncident(
  data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const incident: Incident = { ...data, id, createdAt: now, updatedAt: now }
    await apiFetch('/api/incidents', { method: 'POST', body: JSON.stringify(incident) })
    return id
  }

  return fbAdd('incidents', { ...data, id })
}

export async function getIncident(id: string): Promise<Incident | null> {
  if (DEMO_MODE) {
    try { return await apiFetch<Incident>(`/api/incidents/${id}`) }
    catch (err) { if (err instanceof Error && err.message.includes('404')) return null; throw err }
  }
  return fbGet('incidents', id) as Promise<Incident | null>
}

export async function updateIncident(id: string, data: Partial<Incident>): Promise<void> {
  if (DEMO_MODE) {
    await apiFetch(`/api/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    return
  }
  await fbUpdate('incidents', id, data as Record<string, unknown>)
}

export async function listIncidents(userId?: string): Promise<Incident[]> {
  if (DEMO_MODE) {
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    return apiFetch<Incident[]>(`/api/incidents?${params}`)
  }
  return fbList('incidents', userId) as Promise<Incident[]>
}

export async function deleteIncident(id: string): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/incidents/${id}`, { method: 'DELETE' }); return }
  await fbDelete('incidents', id)
}

export async function findIncidentsByLot(lotNumber: string, userId?: string): Promise<Incident[]> {
  if (DEMO_MODE) {
    const params = new URLSearchParams({ lotNumber })
    if (userId) params.set('userId', userId)
    return apiFetch<Incident[]>(`/api/incidents?${params}`)
  }
  const { collection, query, where, getDocs } = await import('firebase/firestore')
  const db = await getDB()
  const constraints = [where('lotNumber', '==', lotNumber)]
  if (userId) constraints.push(where('createdBy', '==', userId))
  const snap = await getDocs(query(collection(db, 'incidents'), ...constraints))
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Incident))
}

// ── 検査記録 ─────────────────────────────────────────────────────

export async function createInspectionRecord(
  data: Omit<InspectionRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const item: InspectionRecord = { ...data, id, createdAt: now, updatedAt: now }
    await apiFetch('/api/inspections', { method: 'POST', body: JSON.stringify(item) })
    return id
  }
  return fbAdd('inspections', { ...data, id })
}

export async function listInspections(userId?: string): Promise<InspectionRecord[]> {
  if (DEMO_MODE) {
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    return apiFetch<InspectionRecord[]>(`/api/inspections?${params}`)
  }
  return fbList('inspections', userId) as Promise<InspectionRecord[]>
}

export async function getInspection(id: string): Promise<InspectionRecord | null> {
  if (DEMO_MODE) {
    try { return await apiFetch<InspectionRecord>(`/api/inspections/${id}`) }
    catch { return null }
  }
  return fbGet('inspections', id) as Promise<InspectionRecord | null>
}

export async function updateInspection(id: string, data: Partial<InspectionRecord>): Promise<void> {
  if (DEMO_MODE) {
    await apiFetch(`/api/inspections/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    return
  }
  await fbUpdate('inspections', id, data as Record<string, unknown>)
}

export async function deleteInspection(id: string): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/inspections/${id}`, { method: 'DELETE' }); return }
  await fbDelete('inspections', id)
}

// ── マスターデータ ────────────────────────────────────────────────

export interface MasterData {
  staff: string[]
  products: string[]
  devices: { name: string; type: 'metal_detector' | 'xray'; line?: string }[]
}

const MASTER_DOC_ID = 'global'

export async function getMasters(): Promise<MasterData> {
  const empty: MasterData = { staff: [], products: [], devices: [] }
  if (DEMO_MODE) {
    return apiFetch<MasterData>('/api/masters').catch(() => empty)
  }
  const { doc, getDoc } = await import('firebase/firestore')
  const db = await getDB()
  const snap = await getDoc(doc(db, 'masters', MASTER_DOC_ID))
  return snap.exists() ? snap.data() as MasterData : empty
}

export async function saveMasters(data: MasterData): Promise<void> {
  if (DEMO_MODE) {
    await apiFetch('/api/masters', { method: 'POST', body: JSON.stringify(data) })
    return
  }
  const { doc, setDoc } = await import('firebase/firestore')
  const db = await getDB()
  await setDoc(doc(db, 'masters', MASTER_DOC_ID), data)
}

// ── 官能検査 ─────────────────────────────────────────────────────

export async function createSensoryEvaluation(
  data: Omit<SensoryEvaluation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const item: SensoryEvaluation = { ...data, id, createdAt: now, updatedAt: now }
    await apiFetch('/api/sensory', { method: 'POST', body: JSON.stringify(item) }).catch(() => {})
    return id
  }
  return fbAdd('sensory_evaluations', { ...data, id })
}

export async function getSensoryEvaluation(id: string): Promise<SensoryEvaluation | null> {
  if (DEMO_MODE) { return apiFetch<SensoryEvaluation>(`/api/sensory/${id}`).catch(() => null) }
  return fbGet('sensory_evaluations', id) as Promise<SensoryEvaluation | null>
}

export async function updateSensoryEvaluation(id: string, data: Partial<SensoryEvaluation>): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/sensory/${id}`, { method: 'PUT', body: JSON.stringify(data) }).catch(() => {}); return }
  await fbUpdate('sensory_evaluations', id, data as Record<string, unknown>)
}

export async function listSensoryEvaluations(userId?: string): Promise<SensoryEvaluation[]> {
  if (DEMO_MODE) {
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    return apiFetch<SensoryEvaluation[]>(`/api/sensory?${params}`).catch(() => [])
  }
  return fbList('sensory_evaluations', userId) as Promise<SensoryEvaluation[]>
}

export async function deleteSensoryEvaluation(id: string): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/sensory/${id}`, { method: 'DELETE' }).catch(() => {}); return }
  await fbDelete('sensory_evaluations', id)
}

// ── 報告書 ───────────────────────────────────────────────────────

export async function createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const id = uuidv4()

  if (DEMO_MODE) {
    const item: Report = { ...data, id, createdAt: now, updatedAt: now }
    await apiFetch('/api/reports', { method: 'POST', body: JSON.stringify(item) })
    return id
  }
  return fbAdd('reports', { ...data, id })
}

export async function getReport(id: string): Promise<Report | null> {
  if (DEMO_MODE) {
    try { return await apiFetch<Report>(`/api/reports/${id}`) }
    catch (err) { if (err instanceof Error && err.message.includes('404')) return null; throw err }
  }
  return fbGet('reports', id) as Promise<Report | null>
}

export async function updateReport(id: string, data: Partial<Report>): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }); return }
  await fbUpdate('reports', id, data as Record<string, unknown>)
}

export async function listReports(userId?: string): Promise<Report[]> {
  if (DEMO_MODE) {
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    return apiFetch<Report[]>(`/api/reports?${params}`)
  }
  return fbList('reports', userId) as Promise<Report[]>
}

export async function deleteReport(id: string): Promise<void> {
  if (DEMO_MODE) { await apiFetch(`/api/reports/${id}`, { method: 'DELETE' }); return }
  await fbDelete('reports', id)
}
