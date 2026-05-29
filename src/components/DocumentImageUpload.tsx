'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { useRouter } from 'next/navigation'

interface Props {
  documentId: string
  currentImageUrl: string | null
}

function centerSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
    width,
    height
  )
}

async function getCroppedBlob(img: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = img.naturalWidth / img.width
  const scaleY = img.naturalHeight / img.height

  const pixelCrop = {
    x: (crop.x / 100) * img.width * scaleX,
    y: (crop.y / 100) * img.height * scaleY,
    width: (crop.width / 100) * img.width * scaleX,
    height: (crop.height / 100) * img.height * scaleY,
  }

  const size = Math.round(Math.min(pixelCrop.width, pixelCrop.height))
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas is empty'))
    }, 'image/jpeg', 0.92)
  })
}

export default function DocumentImageUpload({ documentId, currentImageUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSrc(reader.result as string)
      setCrop(undefined)
      setOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerSquareCrop(width, height))
  }, [])

  async function handleSave() {
    if (!imgRef.current || !crop) return
    setUploading(true)
    setError('')

    try {
      const blob = await getCroppedBlob(imgRef.current, crop)
      const form = new FormData()
      form.append('file', blob, 'cover.jpg')

      const res = await fetch(`/api/documents/${documentId}/image`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Upload failed')
      }

      setOpen(false)
      setSrc(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!confirm('Remove the document image?')) return
    await fetch(`/api/documents/${documentId}/image`, { method: 'DELETE' })
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setSrc(null)
    setError('')
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {currentImageUrl ? (
        <div className="relative group w-16 h-16 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImageUrl}
            alt="Document"
            className="w-16 h-16 rounded-xl object-cover"
            style={{ border: '1px solid var(--border)' }}
          />
          <div
            className="absolute inset-0 rounded-xl flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-white" title="Change image">
              Edit
            </button>
            <span className="text-white opacity-40">·</span>
            <button onClick={handleRemove} className="text-xs font-medium" style={{ color: '#f87171' }} title="Remove image">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-all"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          title="Add document image"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-xs">Image</span>
        </button>
      )}

      {open && src && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="dark-modal rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Crop Document Image
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Drag the handles to adjust the square crop area.
            </p>

            <div className="flex justify-center mb-4 overflow-hidden rounded-lg" style={{ maxHeight: '60vh' }}>
              <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={1} circularCrop={false} keepSelection>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={src}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }}
                />
              </ReactCrop>
            </div>

            {error && (
              <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={handleClose} className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg transition-all">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !crop}
                className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {uploading ? 'Saving...' : 'Save Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
