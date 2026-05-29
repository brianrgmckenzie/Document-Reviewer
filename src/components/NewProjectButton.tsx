'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PROJECT_TYPES = [
  'Faith-Based',
  'Nonprofit',
  'Land-Owning For-Profit',
  'Mixed',
  'Other',
]

interface Props {
  isSuperAdmin?: boolean
  defaultCompanyId?: string
}

export default function NewProjectButton({ isSuperAdmin, defaultCompanyId }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    description: '',
    project_type: '',
    company_id: defaultCompanyId ?? '',
  })
  const router = useRouter()

  useEffect(() => {
    if (open && isSuperAdmin) {
      fetch('/api/companies')
        .then(r => r.json())
        .then(d => setCompanies(d.companies ?? []))
    }
  }, [open, isSuperAdmin])

  function reset() {
    setForm({ name: '', client_name: '', description: '', project_type: '', company_id: defaultCompanyId ?? '' })
    setError('')
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const { project } = await res.json()
      reset()
      router.push(`/projects/${project.slug}`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create project')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
      >
        New Project
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>New Project</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Company
                  </label>
                  <select
                    value={form.company_id}
                    onChange={e => setForm({ ...form, company_id: e.target.value })}
                    className="dark-select w-full px-3 py-2 rounded-lg text-sm outline-none"
                  >
                    <option value="">No company</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Project Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Trinity Church — 2024 Review"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Client / Organization <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                  placeholder="e.g. Trinity United Church"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Organization Type
                </label>
                <select
                  value={form.project_type}
                  onChange={e => setForm({ ...form, project_type: e.target.value })}
                  className="dark-select w-full px-3 py-2 rounded-lg text-sm outline-none"
                >
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief notes on scope or context..."
                  rows={3}
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                />
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
