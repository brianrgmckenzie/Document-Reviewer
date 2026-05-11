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
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [tab, setTab] = useState<'upload' | 'paste'>('upload')
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function uploadFile(file: File) {
    setUploading(true)
    setStatus(`Uploading ${file.name}...`)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload to Supabase Storage
    const timestamp = Date.now()
    const filePath = `${projectId}/${timestamp}-${file.name}`
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

    await runPipeline(docRecord.id, file.name)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await uploadFile(file)
    }
  }

  function closeModal() {
    setOpen(false)
    setStatus('')
    setUploading(false)
    setDone(false)
    setPasteTitle('')
    setPasteContent('')
  }

  async function runPipeline(docId: string, label: string, textContent?: string) {
    setStatus('Quick scan...')
    const scanRes = await fetch('/api/quick-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId, textContent }),
    })
    if (scanRes.ok) {
      const { scan } = await scanRes.json()
      setStatus(`"${scan.headline ?? label}" — running full analysis...`)
      router.refresh()
    } else {
      setStatus('Running full analysis...')
    }

    const res = await fetch('/api/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId, textContent }),
    })

    if (res.ok) {
      setStatus(`"${label}" fully processed.`)
      setUploading(false)
      setDone(true)
      router.refresh()
    } else {
      setStatus('Full analysis failed — quick scan saved. Use Retry AI to reprocess.')
      setUploading(false)
    }
  }

  async function submitPaste() {
    const content = pasteContent.trim()
    if (!content) return
    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const label = pasteTitle.trim() || 'Pasted content'
    const fileName = `${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.txt`
    const filePath = `${projectId}/${fileName}`
    const blob = new Blob([content], { type: 'text/plain' })

    setStatus(`Saving "${label}"...`)
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, blob)

    if (storageError) {
      setStatus(`Save failed: ${storageError.message}`)
      setUploading(false)
      return
    }

    const { data: docRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        uploaded_by: user.id,
        file_name: fileName,
        file_path: filePath,
        file_type: 'txt',
        file_size: blob.size,
        ai_processed: false,
      })
      .select()
      .single()

    if (dbError || !docRecord) {
      setStatus('Failed to save document record')
      setUploading(false)
      return
    }

    fetch('/api/notify/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileName }),
    }).catch(() => {})

    await runPipeline(docRecord.id, label, content)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); setStatus('') }}
        className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
      >
        Add Documents
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Document</h3>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ background: 'var(--surface-raised)' }}>
              {(['upload', 'paste'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => !uploading && setTab(t)}
                  disabled={uploading}
                  className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-40"
                  style={{
                    background: tab === t ? 'var(--surface)' : 'transparent',
                    color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t === 'upload' ? 'Upload File' : 'Paste Text'}
                </button>
              ))}
            </div>

            {tab === 'upload' ? (
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
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                  disabled={uploading}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors disabled:opacity-40"
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <textarea
                  placeholder="Paste document content here..."
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  disabled={uploading}
                  rows={8}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors disabled:opacity-40"
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  onClick={submitPaste}
                  disabled={uploading || !pasteContent.trim()}
                  className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
                >
                  {uploading ? 'Processing...' : 'Analyse Content'}
                </button>
              </div>
            )}

            {status && (
              <div className="mt-4 text-sm rounded-lg px-4 py-3" style={{ background: done ? 'var(--success-dim, rgba(45,216,138,0.1))' : 'var(--surface-raised)', color: done ? 'var(--success)' : 'var(--text-secondary)' }}>
                {status}
              </div>
            )}

            <div className="flex justify-end mt-4">
              {done ? (
                <button
                  onClick={closeModal}
                  className="dark-btn-primary px-5 py-2 text-sm font-medium rounded-lg transition-all"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={() => !uploading && closeModal()}
                  disabled={uploading}
                  className="px-4 py-2 text-sm transition-colors disabled:opacity-40"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {uploading ? 'Processing...' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
