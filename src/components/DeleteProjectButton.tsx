'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className="dark-btn-danger px-3"
        style={{ height: 32, borderRadius: 8, fontSize: 13 }}
      >
        Delete Project
      </button>

      {confirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="dark-modal rounded-2xl max-w-sm w-full p-6">
            <h3 className="font-semibold mb-2" style={{ fontSize: 16, color: 'var(--text-primary)' }}>Delete project?</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{projectName}</span> and all its documents will be permanently deleted.
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--risk)' }}>This cannot be undone.</p>
            {error && <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--risk-dim)', color: 'var(--risk)' }}>{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirm(false); setError('') }}
                className="dark-btn-outline flex-1"
                style={{ height: 36, borderRadius: 9 }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
                style={{
                  height: 36, borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: 'var(--risk)', color: 'white', border: 'none', cursor: 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  boxShadow: '0 3px 10px rgba(224,48,48,0.30)',
                  transition: 'all 0.15s',
                }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
