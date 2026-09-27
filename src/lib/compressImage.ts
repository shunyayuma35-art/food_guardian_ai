/** 最長辺の上限（px） */
const MAX_SIDE = 1600
/** JPEG 品質 (0〜1) */
const QUALITY = 0.82

export interface CompressedImage {
  base64: string
  mimeType: 'image/jpeg'
}

/**
 * File → 圧縮 JPEG base64。
 * createImageBitmap は EXIF 回転情報を自動適用するため、
 * スマホ縦撮り写真が横向きになる問題が起きない。
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const result = await bitmapToJpeg(bitmap, bitmap.width, bitmap.height)
  bitmap.close()
  return result
}

/**
 * data URL 文字列（画像エンハンス済み画像など）→ 圧縮 JPEG base64。
 * EXIF 回転は既に適用済みと仮定する。
 */
export async function compressDataUrl(dataUrl: string): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      bitmapToJpeg(img, img.naturalWidth, img.naturalHeight).then(resolve, reject)
    img.onerror = reject
    img.src = dataUrl
  })
}

function bitmapToJpeg(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): Promise<CompressedImage> {
  let w = srcW
  let h = srcH
  if (w > MAX_SIDE || h > MAX_SIDE) {
    const ratio = MAX_SIDE / Math.max(w, h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(source, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('compressImage: canvas.toBlob returned null'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve({ base64, mimeType: 'image/jpeg' })
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      QUALITY,
    )
  })
}
