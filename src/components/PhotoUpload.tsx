'use client'

import { useRef } from 'react'
import { useLang } from '@/context/LanguageContext'

interface PhotoUploadProps {
  label: string
  photos: File[]
  onChange: (photos: File[]) => void
  icon?: string
}

export default function PhotoUpload({ label, photos, onChange, icon = '📷' }: PhotoUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const { t } = useLang()

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    onChange([...photos, ...files])
    e.target.value = ''
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div>
      <p className="label">
        {icon} {label}
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((file, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs leading-none font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-white flex items-center justify-center gap-2 transition-colors"
        >
          {t('photo.camera')}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-white flex items-center justify-center gap-2 transition-colors"
        >
          {t('photo.gallery')}
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-center leading-relaxed">
        {t('photo.cameraHint')}
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  )
}
