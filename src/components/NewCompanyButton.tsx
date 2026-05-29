'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCompanyButton() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const router = useRouter()

  function reset() {
    setName('')
    setError('')
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    if (res.ok) {
      const { company } = await res.json()
      reset()
      router.push(`/admin/companies/${company.id}`)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create company')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
      >
        New Company
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>New Company</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Company Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Reframe Concepts"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={reset} className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
