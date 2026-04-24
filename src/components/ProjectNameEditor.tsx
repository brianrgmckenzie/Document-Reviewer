'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  name: string
  clientName: string
  projectType: string | null
  isSuperAdmin: boolean
}

export default function ProjectNameEditor({ projectId, name, clientName, projectType, isSuperAdmin }: Props) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [clientVal, setClientVal] = useState(clientName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    if (!nameVal.trim() || !clientVal.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('projects')
      .update({ name: nameVal.trim(), client_name: clientVal.trim() })
      .eq('id', projectId)
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setEditing(false)
      router.refresh()
    }
  }

  function handleCancel() {
    setNameVal(name)
    setClientVal(clientName)
    setError('')
    setEditing(false)
  }

  if (!isSuperAdmin) {
    return (
      <>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h2>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{clientName}</p>
      </>
    )
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          className="dark-input w-full px-3 py-1.5 rounded-lg text-xl font-semibold outline-none"
          style={{ color: 'var(--text-primary)' }}
          placeholder="Project name"
          autoFocus
        />
        <input
          value={clientVal}
          onChange={e => setClientVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          className="dark-input w-full px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ color: 'var(--text-secondary)' }}
          placeholder="Organization name"
        />
        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !nameVal.trim() || !clientVal.trim()}
            className="dark-btn-primary text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2">
      <div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h2>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{clientName}</p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded"
        style={{ color: 'var(--text-muted)', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
      >
        Edit
      </button>
    </div>
  )
}
