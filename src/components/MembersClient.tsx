'use client'

import { useState } from 'react'

interface Project {
  id: string
  name: string
  slug: string
}

interface Member {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  organization: string | null
  projects: Project[]
}

interface Props {
  projects: Project[]
  members: Member[]
  currentUserId: string
}

function displayName(m: Member) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(' ')
  return full || null
}

export default function MembersClient({ projects, members: initialMembers, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '', password: '', first_name: '', last_name: '', organization: '',
  })
  const [inviteProjects, setInviteProjects] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inviteForm, role: 'client' }),
    })

    if (!res.ok) {
      const data = await res.json()
      setInviteError(data.error ?? 'Failed to create user')
      setInviting(false)
      return
    }

    const { user: newUser } = await res.json()
    await Promise.all(
      inviteProjects.map(projectId =>
        fetch(`/api/admin/users/${newUser.id}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
      )
    )

    const assignedProjects = projects.filter(p => inviteProjects.includes(p.id))
    setMembers(prev => [...prev, {
      id: newUser.id,
      email: newUser.email,
      first_name: inviteForm.first_name || null,
      last_name: inviteForm.last_name || null,
      organization: inviteForm.organization || null,
      projects: assignedProjects,
    }])
    setShowInvite(false)
    setInviteForm({ email: '', password: '', first_name: '', last_name: '', organization: '' })
    setInviteProjects([])
    setInviting(false)
  }

  async function handleAssignProject(memberId: string, projectId: string) {
    await fetch(`/api/admin/users/${memberId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    const p = projects.find(pr => pr.id === projectId)
    if (!p) return
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, projects: [...m.projects, p] } : m
    ))
  }

  async function handleRemoveProject(memberId: string, projectId: string) {
    await fetch(`/api/admin/users/${memberId}/projects`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, projects: m.projects.filter(p => p.id !== projectId) } : m
    ))
  }

  const inviteUnassigned = projects.filter(p => !inviteProjects.includes(p.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Members</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg">
          Invite Member
        </button>
      </div>

      <div className="space-y-3">
        {members.map(member => {
          const name = displayName(member)
          const unassigned = projects.filter(p => !member.projects.some(mp => mp.id === p.id))

          return (
            <div key={member.id} className="dark-card rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {name && (
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
                    )}
                    <span className="text-sm" style={{ color: name ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: name ? 400 : 600 }}>
                      {member.email}
                    </span>
                  </div>
                  {member.organization && (
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{member.organization}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {member.projects.map(p => (
                      <span key={p.id} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        {p.name}
                        <button onClick={() => handleRemoveProject(member.id, p.id)} className="ml-0.5 leading-none">✕</button>
                      </span>
                    ))}
                    {unassigned.length > 0 && (
                      <select
                        onChange={e => { if (e.target.value) handleAssignProject(member.id, e.target.value); e.target.value = '' }}
                        className="dark-select text-xs px-2 py-0.5 rounded-full"
                        style={{ borderStyle: 'dashed' }}
                      >
                        <option value="">+ Add project</option>
                        {unassigned.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    {member.projects.length === 0 && (
                      <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No projects assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {members.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No members yet. Invite someone to get started.</p>
          </div>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Invite Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
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
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Organization</label>
                <input type="text" value={inviteForm.organization}
                  onChange={e => setInviteForm({ ...inviteForm, organization: e.target.value })}
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
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
                  placeholder="Share this with the user to log in"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Assign Projects</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {inviteProjects.map(pid => {
                    const p = projects.find(p => p.id === pid)
                    if (!p) return null
                    return (
                      <span key={pid} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        {p.name}
                        <button type="button" onClick={() => setInviteProjects(prev => prev.filter(id => id !== pid))} className="ml-0.5 leading-none">✕</button>
                      </span>
                    )
                  })}
                  {inviteUnassigned.length > 0 && (
                    <select
                      onChange={e => { if (e.target.value && !inviteProjects.includes(e.target.value)) setInviteProjects(prev => [...prev, e.target.value]); e.target.value = '' }}
                      className="dark-select text-xs px-2 py-0.5 rounded-full"
                      style={{ borderStyle: 'dashed' }}
                    >
                      <option value="">+ Add project</option>
                      {inviteUnassigned.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  {inviteProjects.length === 0 && (
                    <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No projects selected</span>
                  )}
                </div>
              </div>

              {inviteError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                  {inviteError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={() => { setShowInvite(false); setInviteError(''); setInviteProjects([]) }}
                  className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={inviting}
                  className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
                  {inviting ? 'Creating...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
