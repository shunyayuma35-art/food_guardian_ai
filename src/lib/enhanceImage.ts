export interface EnhanceParams {
  sharpness: number   // 0–3
  contrast: number    // 0.5–2
  brightness: number  // 0.5–1.8
  zoom: number        // 1–4
}

export const DEFAULT_PARAMS: EnhanceParams = {
  sharpness: 1.5,
  contrast: 1.2,
  brightness: 1.05,
  zoom: 2,
}

export interface EnhanceResult {
  dataUrl: string  // JPEG quality 0.9
  base64: string   // without leading "data:…,"
}

function loadImage(source: string | HTMLImageElement): Promise<HTMLImageElement> {
  if (typeof source !== 'string') {
    if (source.complete && source.naturalWidth > 0) return Promise.resolve(source)
    return new Promise((resolve, reject) => {
      source.onload = () => resolve(source)
      source.onerror = reject
    })
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = source
  })
}

export async function enhanceImage(
  source: string | HTMLImageElement,
  params: Partial<EnhanceParams> = {}
): Promise<EnhanceResult> {
  if (typeof document === 'undefined') {
    throw new Error('enhanceImage requires a browser environment')
  }

  const p: EnhanceParams = { ...DEFAULT_PARAMS, ...params }
  const img = await loadImage(source)

  // Step 1: Draw at zoom scale with high-quality smoothing
  const canvas = document.createElement('canvas')
  const w = Math.round(img.naturalWidth * p.zoom)
  const h = Math.round(img.naturalHeight * p.zoom)
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  // Step 2: Brightness + contrast: v = (pixel * brightness) * contrast + 128*(1-contrast)
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  const { brightness: b, contrast: c } = p
  const offset = 128 * (1 - c)
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = Math.max(0, Math.min(255, Math.round((d[i]     * b) * c + offset)))
    d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] * b) * c + offset)))
    d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] * b) * c + offset)))
  }
  ctx.putImageData(imgData, 0, 0)

  // Step 3: Unsharp mask – kernel [0,-1,0,-1,5,-1,0,-1,0], amount = sharpness * 0.5
  const amount = p.sharpness * 0.5
  if (amount > 0) {
    const src = ctx.getImageData(0, 0, w, h).data
    const out = new Uint8ClampedArray(src.length)
    const KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0]

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        for (let ch = 0; ch < 3; ch++) {
          let v = 0
          for (let ky = -1; ky <= 1; ky++) {
            const ny = Math.max(0, Math.min(h - 1, y + ky))
            for (let kx = -1; kx <= 1; kx++) {
              const nx = Math.max(0, Math.min(w - 1, x + kx))
              v += src[(ny * w + nx) * 4 + ch] * KERNEL[(ky + 1) * 3 + (kx + 1)]
            }
          }
          // Blend: result = original + (sharpened - original) * amount
          out[i + ch] = src[i + ch] + (v - src[i + ch]) * amount
        }
        out[i + 3] = src[i + 3]
      }
    }
    ctx.putImageData(new ImageData(out, w, h), 0, 0)
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  return { dataUrl, base64: dataUrl.split(',')[1] }
}
