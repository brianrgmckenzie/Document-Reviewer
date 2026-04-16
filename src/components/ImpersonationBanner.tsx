'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  email: string
  role: string | null
}

export default function ImpersonationBanner({ email, role }: Props) {
  const [exiting, setExiting] = useState(false)
  const router = useRouter()

  async function handleExit() {
    setExiting(true)
    await fetch('/api/impersonate', { method: 'DELETE' })
    router.push('/dashboard')
    router.refresh()
  }

  const roleLabel = role === 'client' ? 'Client' : role === 'project_admin' ? 'Project Admin' : role ?? 'No role'

  return (
    <div style={{
      background: 'rgba(245,158,11,0.12)',
      borderBottom: '1px solid rgba(245,158,11,0.3)',
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: '12px', color: '#fbbf24' }}>
        <span style={{ opacity: 0.7 }}>Viewing as</span>
        {' '}
        <strong>{email}</strong>
        {' '}
        <span style={{ opacity: 0.7 }}>({roleLabel})</span>
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#fbbf24',
          background: 'rgba(245,158,11,0.2)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '4px',
          padding: '2px 10px',
          cursor: 'pointer',
          opacity: exiting ? 0.5 : 1,
        }}
      >
        {exiting ? 'Exiting...' : 'Exit'}
      </button>
    </div>
  )
}
