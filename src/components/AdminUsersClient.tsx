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
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', role: 'project_admin' })
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
      setShowInvite(false)
      setInviteForm({ email: '', password: '', role: 'project_admin' })
      await loadUsers()
    } else {
      const data = await res.json()
      setInviteError(data.error ?? 'Failed to create user')
    }
    setInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
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

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading users...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          Invite User
        </button>
      </div>

      <div className="space-y-3">
        {users.map(user => {
          const unassigned = projects.filter(p => !user.projects.some(up => up.id === p.id))
          const isMe = user.id === currentUserId

          return (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">
                      {user.email}
                      {isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </span>
                    <select
                      value={user.role ?? ''}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      disabled={isMe}
                      className="text-xs px-2 py-0.5 border border-gray-200 rounded-lg text-gray-700 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">No role</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="project_admin">Project Admin</option>
                    </select>
                  </div>

                  {user.role === 'project_admin' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {user.projects.map(p => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full flex items-center gap-1"
                        >
                          {p.name}
                          <button
                            onClick={() => handleRemoveProject(user.id, p.id)}
                            className="text-blue-400 hover:text-red-500 ml-0.5 leading-none"
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
                          className="text-xs px-2 py-0.5 border border-dashed border-gray-300 rounded-full text-gray-500 bg-white"
                        >
                          <option value="">+ Add project</option>
                          {unassigned.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                      {user.projects.length === 0 && (
                        <span className="text-xs text-gray-400 italic">No projects assigned</span>
                      )}
                    </div>
                  )}

                  {user.role === 'super_admin' && (
                    <p className="text-xs text-gray-400 mt-1">Access to all projects</p>
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
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg w-36 outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        disabled={resetting || !resetPassword.trim()}
                        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40"
                      >
                        {resetting ? 'Saving...' : 'Set'}
                      </button>
                      <button
                        onClick={() => { setResetTarget(null); setResetPassword('') }}
                        className="text-xs text-gray-400 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setResetTarget(user.id)}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded"
                      >
                        Reset password
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email ?? '')}
                          className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Invite User</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                <input
                  required
                  type="text"
                  value={inviteForm.password}
                  onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Share this with the user to log in"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="project_admin">Project Admin — upload and CRAAP scoring only</option>
                  <option value="super_admin">Super Admin — full access</option>
                </select>
              </div>

              {inviteError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{inviteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowInvite(false); setInviteError('') }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
