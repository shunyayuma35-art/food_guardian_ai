import { DEMO_MODE, app } from './firebase'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  // DEMOモード（Vercelデモ含む）: ブラウザ内Base64
  if (DEMO_MODE) {
    return fileToBase64(file)
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
