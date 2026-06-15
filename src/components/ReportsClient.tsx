'use client'

import { useState } from 'react'
import { exportManuscriptToDocx } from '@/lib/exportDocx'
import ManuscriptRenderer from '@/components/ManuscriptRenderer'
import { Copy, FileDown, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import type { AdHocReport } from '@/lib/types'

interface Props {
  project: { id: string; client_name: string }
  processedCount: number
  initialReports: AdHocReport[]
}

export default function ReportsClient({ project, processedCount, initialReports }: Props) {
  const [reports, setReports] = useState<AdHocReport[]>(initialReports)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(initialReports[0]?.id ?? null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError('')

    const response = await fetch(`/api/projects/${project.id}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (response.ok) {
      const { report } = await response.json()
      setReports(r => [report, ...r])
      setExpandedId(report.id)
      setPrompt('')
    } else {
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'Generation failed')
    }
    setGenerating(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeletingId(id)
    const response = await fetch(`/api/projects/${project.id}/reports/${id}`, { method: 'DELETE' })
    if (response.ok) {
      setReports(r => r.filter(rep => rep.id !== id))
      if (expandedId === id) setExpandedId(null)
    }
    setDeletingId(null)
  }

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content)
  }

  async function handleExportDocx(report: AdHocReport) {
    const blob = await exportManuscriptToDocx(report.content, project.client_name)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.client_name} — ${report.title}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Generate */}
      <div className="dark-card rounded-xl p-5">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Ad Hoc Reports</h2>
        <p className="text-sm mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
          Describe a document inventory, status memo, or other administrative report. Synthesizes {processedCount} processed document{processedCount !== 1 ? 's' : ''}.
        </p>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. Produce a document inventory and gap analysis table with columns for Document type, Date, Source, and Status (Valid / Needs Update / Obsolete / Unknown)."
          maxLength={4000}
          className="dark-textarea w-full px-3 py-2 rounded-lg text-sm"
          style={{ minHeight: '120px' }}
        />
        {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex justify-end mt-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || processedCount === 0}
            className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {generating && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Generating report...</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This takes 20-40 seconds</p>
        </div>
      )}

      {/* Past reports */}
      {reports.length === 0 && !generating ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No reports yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Describe what you need above to generate your first report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const expanded = expandedId === report.id
            return (
              <div key={report.id} className="dark-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                  className="w-full flex items-center justify-between gap-3 text-left p-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{report.title}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} className="shrink-0" /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} className="shrink-0" />}
                </button>
                {expanded && (
                  <div className="px-5 pb-5">
                    <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => handleCopy(report.content)} className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5">
                        <Copy size={14} />
                        Copy
                      </button>
                      <button onClick={() => handleExportDocx(report)} className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5">
                        <FileDown size={14} />
                        Export
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                        style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                      >
                        <Trash2 size={14} />
                        {deletingId === report.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-semibold">Request:</span> {report.prompt}
                    </p>
                    <ManuscriptRenderer text={report.content} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
