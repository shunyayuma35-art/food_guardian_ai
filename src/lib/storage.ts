import { DEMO_MODE, app } from './firebase'

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  // DEMOモード: 圧縮後 IndexedDB に保存して参照ID を返す
  if (DEMO_MODE) {
    try {
      const { compressImage } = await import('./compressImage')
      const { storePhotoUrl } = await import('./photo-store')
      const compressed = await compressImage(file)
      return storePhotoUrl(`data:${compressed.mimeType};base64,${compressed.base64}`)
    } catch {
      // IndexedDB 失敗時は base64 のまま返す（フォールバック）
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }
  }

  // Firebase Storageモード（本番）
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
