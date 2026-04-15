'use client'

import { useState, useEffect } from 'react'

interface Project {
  id: string
  name: string
  slug: string
}

interface UserWithRole {
  id: string
  email: string | undefined
  role: string | null
  projects: Project[]
  created_at: string
}

interface Props {
  projects: Project[]
  currentUserId: string
}

export default function AdminUsersClient({ projects, currentUserId }: Props) {
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', role: 'client' })
  const [inviteProjects, setInviteProjects] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    })

    if (res.ok) {
      const { user: newUser } = await res.json()
      // Assign selected projects
      await Promise.all(
        inviteProjects.map(projectId =>
          fetch(`/api/admin/users/${newUser.id}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          })
        )
      )
      setShowInvite(false)
      setInviteForm({ email: '', password: '', role: 'client' })
      setInviteProjects([])
      await loadUsers()
    } else {
      const data = await res.json()
      setInviteError(data.error ?? 'Failed to create user')
    }
    setInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    // Optimistic update so the select reflects immediately
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await loadUsers()
  }

  async function handleResetPassword(userId: string) {
    if (!resetPassword.trim()) return
    setResetting(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    })
    setResetTarget(null)
    setResetPassword('')
    setResetting(false)
  }

  async function handleAssignProject(userId: string, projectId: string) {
    await fetch(`/api/admin/users/${userId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    await loadUsers()
  }

  async function handleRemoveProject(userId: string, projectId: string) {
    await fetch(`/api/admin/users/${userId}/projects`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    await loadUsers()
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (!confirm(`Remove user ${email}? This cannot be undone.`)) return
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    await loadUsers()
  }

  function addInviteProject(projectId: string) {
    if (projectId && !inviteProjects.includes(projectId)) {
      setInviteProjects(prev => [...prev, projectId])
    }
  }

  function removeInviteProject(projectId: string) {
    setInviteProjects(prev => prev.filter(id => id !== projectId))
  }

  if (loading) {
    return <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading users...</div>
  }

  const showProjectAssignment = (role: string | null) => role === 'project_admin' || role === 'client'
  const inviteRoleNeedsProjects = inviteForm.role === 'project_admin' || inviteForm.role === 'client'
  const inviteUnassigned = projects.filter(p => !inviteProjects.includes(p.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Users</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
        >
          Invite User
        </button>
      </div>

      <div className="space-y-3">
        {users.map(user => {
          const unassigned = projects.filter(p => !user.projects.some(up => up.id === p.id))
          const isMe = user.id === currentUserId

          return (
            <div key={user.id} className="dark-card rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {user.email}
                      {isMe && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>}
                    </span>
                    <select
                      value={user.role ?? ''}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      disabled={isMe}
                      className="dark-select text-xs px-2 py-0.5 rounded-lg outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">No role</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="project_admin">Project Admin</option>
                      <option value="client">Client</option>
                    </select>
                  </div>

                  {showProjectAssignment(user.role) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {user.projects.map(p => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}
                        >
                          {p.name}
                          <button
                            onClick={() => handleRemoveProject(user.id, p.id)}
                            className="ml-0.5 leading-none transition-colors"
                            style={{ color: 'var(--blue)' }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {unassigned.length > 0 && (
                        <select
                          onChange={e => {
                            if (e.target.value) handleAssignProject(user.id, e.target.value)
                            e.target.value = ''
                          }}
                          className="dark-select text-xs px-2 py-0.5 rounded-full"
                          style={{ borderStyle: 'dashed' }}
                        >
                          <option value="">+ Add project</option>
                          {unassigned.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                      {user.projects.length === 0 && (
                        <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No projects assigned</span>
                      )}
                    </div>
                  )}

                  {user.role === 'super_admin' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Access to all projects</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {resetTarget === user.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        placeholder="New password"
                        className="dark-input text-xs px-3 py-1.5 rounded-lg w-36 outline-none"
                      />
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        disabled={resetting || !resetPassword.trim()}
                        className="dark-btn-primary text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                      >
                        {resetting ? 'Saving...' : 'Set'}
                      </button>
                      <button
                        onClick={() => { setResetTarget(null); setResetPassword('') }}
                        className="text-xs transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setResetTarget(user.id)}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Reset password
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email ?? '')}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Invite User</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Temporary Password</label>
                <input
                  required
                  type="text"
                  value={inviteForm.password}
                  onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Share this with the user to log in"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => {
                    setInviteForm({ ...inviteForm, role: e.target.value })
                    setInviteProjects([])
                  }}
                  className="dark-select w-full px-3 py-2 rounded-lg text-sm outline-none"
                >
                  <option value="client">Client — project status, documents, comments</option>
                  <option value="project_admin">Project Admin — upload and CRAAP scoring</option>
                  <option value="super_admin">Super Admin — full access</option>
                </select>
              </div>

              {inviteRoleNeedsProjects && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Assign Projects
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {inviteProjects.map(pid => {
                      const p = projects.find(p => p.id === pid)
                      if (!p) return null
                      return (
                        <span
                          key={pid}
                          className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }}
                        >
                          {p.name}
                          <button type="button" onClick={() => removeInviteProject(pid)} className="ml-0.5 leading-none">✕</button>
                        </span>
                      )
                    })}
                    {inviteUnassigned.length > 0 && (
                      <select
                        onChange={e => { addInviteProject(e.target.value); e.target.value = '' }}
                        className="dark-select text-xs px-2 py-0.5 rounded-full"
                        style={{ borderStyle: 'dashed' }}
                      >
                        <option value="">+ Add project</option>
                        {inviteUnassigned.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    {inviteProjects.length === 0 && (
                      <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No projects selected</span>
                    )}
                  </div>
                </div>
              )}

              {inviteError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>{inviteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowInvite(false); setInviteError(''); setInviteProjects([]) }}
                  className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {inviting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
