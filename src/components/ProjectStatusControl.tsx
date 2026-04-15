'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'intake', label: 'Intake', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  { value: 'under_review', label: 'Under Review', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  { value: 'complete', label: 'Complete', bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
]

interface Props {
  projectId: string
  currentStatus: string
  isSuperAdmin: boolean
}

export default function ProjectStatusControl({ projectId, currentStatus, isSuperAdmin }: Props) {
  const [status, setStatus] = useState(currentStatus ?? 'intake')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const current = STATUSES.find(s => s.value === status) ?? STATUSES[0]

  async function handleChange(newStatus: string) {
    if (!isSuperAdmin || newStatus === status) return
    setSaving(true)
    setStatus(newStatus)
    await fetch(`/api/projects/${projectId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSaving(false)
    router.refresh()
  }

  if (!isSuperAdmin) {
    return (
      <span
        className="text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: current.bg, color: current.color }}
      >
        {current.label}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: current.bg, color: current.color }}
      >
        {current.label}
        {saving && ' ...'}
      </span>
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        className="dark-select text-xs px-2 py-0.5 rounded-lg outline-none transition-all disabled:opacity-50"
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
