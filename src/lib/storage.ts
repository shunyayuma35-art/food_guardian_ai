import { DEMO_MODE, app } from './firebase'

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  // ローカルモード: サーバーAPIにアップロード
  if (DEMO_MODE) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`写真のアップロードに失敗しました: ${res.status}`)
    const { url } = await res.json()
    return url as string
  }

  // Firebase Storageモード
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const storage = getStorage(app!)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `incidents/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

export async function uploadPhotos(userId: string, files: File[]): Promise<string[]> {
  return Promise.all(files.map((f) => uploadPhoto(userId, f)))
}
