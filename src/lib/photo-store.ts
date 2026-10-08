const DB_NAME = 'foodeye_photos'
const STORE_NAME = 'photos'
const DB_VERSION = 1

export const IDB_PREFIX = 'idb:'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putPhoto(dataUrl: string): Promise<string> {
  const id = crypto.randomUUID()
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(dataUrl, id)
    tx.oncomplete = () => { db.close(); resolve(id) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getPhoto(id: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** data URL を IndexedDB に保存して参照文字列 "idb:{uuid}" を返す */
export async function storePhotoUrl(dataUrl: string): Promise<string> {
  const id = await putPhoto(dataUrl)
  return `${IDB_PREFIX}${id}`
}

/** "idb:{uuid}" を data URL に解決する。data: で始まる文字列はそのまま返す */
export async function resolvePhotoRef(ref: string): Promise<string> {
  if (!ref.startsWith(IDB_PREFIX)) return ref
  const id = ref.slice(IDB_PREFIX.length)
  return (await getPhoto(id)) ?? ref
}
