'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { exportManuscriptToDocx } from '@/lib/exportDocx'

interface Props {
  project: { id: string; name: string; client_name: string }
  processedCount: number
  initialManuscript: string | null
  manuscriptGeneratedAt: string | null
  readOnly?: boolean
}

function renderManuscript(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold mb-6 pb-4" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-8 mb-3" style={{ color: 'var(--text-primary)' }}>{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2" style={{ color: 'var(--text-secondary)' }}>{line.slice(4)}</h3>)
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} className="flex gap-3 mb-2">
          <span className="shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>{line.match(/^\d+/)![0]}.</span>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{line.replace(/^\d+\.\s/, '')}</p>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-3 mb-1.5 ml-2">
          <span className="shrink-0 mt-1.5" style={{ color: 'var(--text-muted)' }}>•</span>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{line.slice(2)}</p>
        </div>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="my-6" style={{ borderColor: 'var(--border)' }} />)
    } else if (line.startsWith('*') && line.endsWith('*')) {
      elements.push(<p key={i} className="text-xs italic mt-4" style={{ color: 'var(--text-muted)' }}>{line.replace(/^\*|\*$/g, '')}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="leading-relaxed mb-1" style={{ color: 'var(--text-secondary)' }}>{line}</p>)
    }
  })

  return elements
}

export default function ManuscriptClient({ project, processedCount, initialManuscript, manuscriptGeneratedAt, readOnly }: Props) {
  const [manuscript, setManuscript] = useState(initialManuscript)
  const [generatedAt, setGeneratedAt] = useState(manuscriptGeneratedAt)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'rendered' | 'raw'>('rendered')
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setShowConfirm(false)
    setGenerating(true)
    setError('')

    const response = await fetch('/api/generate-manuscript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })

    if (response.ok) {
      const { manuscript: newManuscript } = await response.json()
      setManuscript(newManuscript)
      setGeneratedAt(new Date().toISOString())
      router.refresh()
    } else {
      const { error: err } = await response.json()
      setError(err ?? 'Generation failed')
    }

    setGenerating(false)
  }

  function handleCopy() {
    if (manuscript) navigator.clipboard.writeText(manuscript)
  }

  async function handleExportDocx() {
    if (!manuscript) return
    const blob = await exportManuscriptToDocx(manuscript, project.client_name)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.client_name} — Intake Manuscript.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="dark-card rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Intake Manuscript</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {readOnly
              ? 'Document review summary prepared for your project'
              : `Synthesizes ${processedCount} processed document${processedCount !== 1 ? 's' : ''} into a consultant briefing`}
            {generatedAt && (
              <span style={{ color: 'var(--text-muted)' }}> · Last generated {new Date(generatedAt).toLocaleString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {manuscript && (
            <>
              <button
                onClick={handleCopy}
                className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg"
              >
                Copy
              </button>
              <button
                onClick={handleExportDocx}
                className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg"
              >
                Export .docx
              </button>
              {!readOnly && (
                <button
                  onClick={() => setView(v => v === 'rendered' ? 'raw' : 'rendered')}
                  className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg"
                >
                  {view === 'rendered' ? 'Raw' : 'Rendered'}
                </button>
              )}
            </>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={generating || processedCount === 0}
              className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {generating ? 'Generating...' : manuscript ? 'Regenerate' : 'Generate Manuscript'}
            </button>
          )}
        </div>
      </div>

      {/* CRAAP confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Before you generate</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              The manuscript is built on your CRAAP scores. Higher-scored documents will carry more weight in the synthesis. Please confirm you've completed this work before proceeding.
            </p>
            <ul className="space-y-3 mb-6">
              {[
                'All documents have been AI-processed',
                'CRAAP scores have been reviewed and adjusted for each document',
                'Project-level CRAAP dimension weights reflect this engagement\'s priorities',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ border: '2px solid var(--border)', color: 'var(--text-muted)' }}>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg"
              >
                Not yet — go back
              </button>
              <button
                onClick={handleGenerate}
                className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg"
              >
                Yes — generate
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-5 py-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>
      )}

      {!readOnly && processedCount === 0 && !manuscript && (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No processed documents yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Upload and process documents before generating a manuscript.</p>
        </div>
      )}

      {generating && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Synthesizing {processedCount} documents...</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This takes 30–60 seconds</p>
        </div>
      )}

      {manuscript && !generating && (
        <div className="dark-card rounded-xl p-10">
          {view === 'rendered' || readOnly ? (
            <div className="prose-reframe">
              {renderManuscript(manuscript)}
            </div>
          ) : (
            <textarea
              value={manuscript}
              onChange={e => setManuscript(e.target.value)}
              className="w-full h-[70vh] font-mono text-sm border-0 outline-none resize-none"
              style={{ background: 'transparent', color: 'var(--text-secondary)' }}
            />
          )}
        </div>
      )}
    </div>
  )
}
