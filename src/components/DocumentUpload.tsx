'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
}

export default function DocumentUpload({ projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function uploadFile(file: File) {
    setUploading(true)
    setStatus(`Uploading ${file.name}...`)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload to Supabase Storage
    const filePath = `${projectId}/${Date.now()}-${file.name}`
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (storageError) {
      setStatus(`Upload failed: ${storageError.message}`)
      setUploading(false)
      return
    }

    // Insert document record
    const { data: docRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.name.split('.').pop()?.toLowerCase(),
        file_size: file.size,
        ai_processed: false,
      })
      .select()
      .single()

    if (dbError || !docRecord) {
      setStatus('Failed to save document record')
      setUploading(false)
      return
    }

    // Notify staff of upload (fire and forget)
    fetch('/api/notify/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileName: file.name }),
    }).catch(() => {})

    // Step 1: Quick scan (fast, uses Haiku)
    setStatus('Quick scan...')
    const scanResponse = await fetch('/api/quick-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docRecord.id }),
    })

    if (scanResponse.ok) {
      const { scan } = await scanResponse.json()
      setStatus(`"${scan.headline ?? file.name}" — running full analysis...`)
      router.refresh()
    } else {
      setStatus('Running full analysis...')
    }

    // Step 2: Full analysis (thorough, uses Opus)
    const response = await fetch('/api/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docRecord.id }),
    })

    if (response.ok) {
      setStatus(`Done! ${file.name} fully processed.`)
      setTimeout(() => {
        setOpen(false)
        setStatus('')
        setUploading(false)
        router.refresh()
      }, 1500)
    } else {
      setStatus('Full analysis failed — quick scan saved. Use Retry AI to reprocess.')
      setUploading(false)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await uploadFile(file)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
      >
        Upload Documents
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Upload Documents</h3>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => !uploading && inputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors"
              style={{
                borderColor: dragOver ? 'var(--blue)' : 'var(--border)',
                background: dragOver ? 'var(--blue-dim)' : 'transparent',
                opacity: uploading ? 0.6 : 1,
                cursor: uploading ? 'default' : 'pointer',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Drop files here or click to select
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                PDF, DOCX, XLSX, TXT — multiple files supported
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.txt,.csv,.doc"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </div>

            {status && (
              <div className="mt-4 text-sm rounded-lg px-4 py-3" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                {status}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => { if (!uploading) { setOpen(false); setStatus('') } }}
                disabled={uploading}
                className="px-4 py-2 text-sm transition-colors disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
              >
                {uploading ? 'Processing...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
