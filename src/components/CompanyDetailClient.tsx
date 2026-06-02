'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Member {
  user_id: string
  role: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

interface Project {
  id: string
  name: string
  slug: string
  status: string | null
  created_at: string
}

interface Company {
  id: string
  name: string
  slug: string
}

interface Props {
  company: Company
  members: Member[]
  projects: Project[]
  statusStyles: Record<string, { label: string; color: string }>
}

function displayName(m: Member) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(' ')
  return full || m.email || m.user_id
}

export default function CompanyDetailClient({ company, members: initialMembers, projects, statusStyles }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [companyName, setCompanyName] = useState(company.name)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(company.name)
  const [savingName, setSavingName] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteTab, setInviteTab] = useState<'new' | 'existing'>('existing')
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [existingEmail, setExistingEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const router = useRouter()

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setSavingName(true)
    const res = await fetch(`/api/companies/${company.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    if (res.ok) {
      setCompanyName(nameInput.trim())
      setEditingName(false)
      router.refresh()
    }
    setSavingName(false)
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const res = await fetch(`/api/companies/${company.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    })

    if (res.ok) {
      const { user } = await res.json()
      setMembers(prev => [...prev, {
        user_id: user.id,
        role: 'admin',
        email: user.email,
        first_name: inviteForm.first_name || null,
        last_name: inviteForm.last_name || null,
      }])
      setShowInvite(false)
      setInviteForm({ email: '', password: '', first_name: '', last_name: '' })
    } else {
      const data = await res.json()
      setInviteError(data.error ?? 'Failed to create admin')
    }
    setInviting(false)
  }

  async function handleAddExisting(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const res = await fetch(`/api/companies/${company.id}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: existingEmail }),
    })

    if (res.ok) {
      const { user } = await res.json()
      setMembers(prev => [...prev, user])
      setShowInvite(false)
      setExistingEmail('')
    } else {
      const data = await res.json()
      setInviteError(data.error ?? 'Failed to add user')
    }
    setInviting(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this company admin?')) return
    const res = await fetch(`/api/companies/${company.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    }
  }

  return (
    <div className="space-y-8">
      {/* Company name */}
      <div className="dark-card rounded-xl p-6">
        {editingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-3">
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="dark-input flex-1 px-3 py-2 rounded-lg text-sm outline-none font-semibold"
              style={{ fontSize: 18, color: 'var(--text-primary)' }}
              autoFocus
            />
            <button type="submit" disabled={savingName} className="dark-btn-primary px-4 py-2 text-sm rounded-lg disabled:opacity-50">
              {savingName ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditingName(false); setNameInput(companyName) }}
              className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{companyName}</h2>
            <button onClick={() => setEditingName(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              Rename
            </button>
          </div>
        )}
      </div>

      {/* Company admins */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Company Admins <span className="font-normal text-sm ml-2" style={{ color: 'var(--text-muted)' }}>{members.length}</span>
          </h3>
          <button onClick={() => setShowInvite(true)} className="dark-btn-primary px-3 py-1.5 text-sm font-medium rounded-lg">
            Add Admin
          </button>
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No admins yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="dark-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName(m)}</p>
                  {(m.first_name || m.last_name) && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects */}
      <div>
        <h3 className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
          Projects <span className="font-normal text-sm ml-2" style={{ color: 'var(--text-muted)' }}>{projects.length}</span>
        </h3>

        {projects.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => {
              const style = statusStyles[p.status ?? 'intake'] ?? statusStyles.intake
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="dark-card block rounded-xl p-4 hover:border-[var(--border-hover)] transition-colors"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <span className="text-xs font-semibold" style={{ color: style.color }}>{style.label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Add admin modal */}
      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Company Admin</h3>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 rounded-lg p-1" style={{ background: 'var(--surface-raised)' }}>
              {(['existing', 'new'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setInviteTab(t); setInviteError('') }}
                  className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                  style={{
                    background: inviteTab === t ? 'var(--surface)' : 'transparent',
                    color: inviteTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t === 'existing' ? 'Existing User' : 'New User'}
                </button>
              ))}
            </div>

            {inviteTab === 'existing' ? (
              <form onSubmit={handleAddExisting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Email address <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={existingEmail}
                    onChange={e => setExistingEmail(e.target.value)}
                    placeholder="mike@example.com"
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                  />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Must match an existing account in the system.
                  </p>
                </div>

                {inviteError && (
                  <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                    {inviteError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button"
                    onClick={() => { setShowInvite(false); setInviteError(''); setExistingEmail('') }}
                    className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting}
                    className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
                    {inviting ? 'Adding...' : 'Add Admin'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleInviteAdmin} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>First Name</label>
                    <input type="text" value={inviteForm.first_name}
                      onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                      className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
                    <input type="text" value={inviteForm.last_name}
                      onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                      className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Email <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input required type="email" value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Temporary Password <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input required type="text" value={inviteForm.password}
                    onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Share this with the user"
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
                </div>

                {inviteError && (
                  <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                    {inviteError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button"
                    onClick={() => { setShowInvite(false); setInviteError('') }}
                    className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting}
                    className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
                    {inviting ? 'Creating...' : 'Create Admin'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
