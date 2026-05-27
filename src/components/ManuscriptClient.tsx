'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { exportManuscriptToDocx } from '@/lib/exportDocx'
import ManuscriptRenderer from '@/components/ManuscriptRenderer'
import { Copy, FileDown, Share2, Code, RefreshCw, Play, Square, Link } from 'lucide-react'

interface Props {
  project: { id: string; name: string; client_name: string }
  processedCount: number
  initialManuscript: string | null
  manuscriptGeneratedAt: string | null
  readOnly?: boolean
  isSuperAdmin?: boolean
  initialShareToken?: string | null
  initialShareEnabled?: boolean
}

export default function ManuscriptClient({
  project,
  processedCount,
  initialManuscript,
  manuscriptGeneratedAt,
  readOnly,
  isSuperAdmin,
  initialShareToken,
  initialShareEnabled,
}: Props) {
  const [manuscript, setManuscript] = useState(initialManuscript)
  const [generatedAt, setGeneratedAt] = useState(manuscriptGeneratedAt)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'rendered' | 'raw'>('rendered')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(initialShareEnabled ?? false)
  const [shareToken, setShareToken] = useState(initialShareToken ?? null)
  const [sharingLoading, setSharingLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [origin, setOrigin] = useState('')
  const [listening, setListening] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const router = useRouter()

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  function stripMarkdown(text: string) {
    return text
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^---+$/gm, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function handleListen() {
    if (listening) {
      window.speechSynthesis.cancel()
      setListening(false)
      return
    }
    if (!manuscript) return
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(manuscript))
    utterance.rate = 0.95
    utterance.onend = () => setListening(false)
    utterance.onerror = () => setListening(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setListening(true)
  }

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

  async function handleToggleShare(enable: boolean) {
    setSharingLoading(true)
    setShareError('')
    const response = await fetch(`/api/projects/${project.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enable }),
    })
    if (response.ok) {
      const { shareToken: token, shareEnabled: enabled } = await response.json()
      setShareToken(token)
      setShareEnabled(enabled)
    } else {
      const body = await response.json().catch(() => ({}))
      setShareError(body.error ?? 'Failed to update sharing')
    }
    setSharingLoading(false)
  }

  function handleCopyShareLink() {
    if (shareToken) navigator.clipboard.writeText(`${origin}/share/${shareToken}`)
  }

  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : ''

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
                className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={handleExportDocx}
                className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
              >
                <FileDown size={14} />
                Export
              </button>
              <button
                onClick={handleListen}
                className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
                style={listening ? { color: 'var(--blue)', borderColor: 'var(--blue)' } : {}}
              >
                {listening ? <Square size={14} /> : <Play size={14} />}
                {listening ? 'Stop' : 'Listen'}
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowShare(true)}
                  className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
                  style={shareEnabled ? { color: 'var(--blue)', borderColor: 'var(--blue)' } : {}}
                >
                  {shareEnabled ? <Link size={14} /> : <Share2 size={14} />}
                  {shareEnabled ? 'Shared' : 'Share'}
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={() => setView(v => v === 'rendered' ? 'raw' : 'rendered')}
                  className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
                >
                  <Code size={14} />
                  {view === 'rendered' ? 'Raw' : 'Rendered'}
                </button>
              )}
            </>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={generating || processedCount === 0}
              className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              {generating ? 'Generating...' : manuscript ? 'Regenerate' : 'Generate Manuscript'}
            </button>
          )}
        </div>
      </div>

      {/* PARCA confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Before you generate</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              The manuscript is built on your PARCA scores. Higher-scored documents will carry more weight in the synthesis. Please confirm you've completed this work before proceeding.
            </p>
            <ul className="space-y-3 mb-6">
              {[
                'All documents have been AI-processed',
                'PARCA scores have been reviewed and adjusted for each document',
                'Project-level PARCA dimension weights reflect this engagement\'s priorities',
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

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="dark-modal rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Share Manuscript</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {shareEnabled
                ? 'Anyone with the link can view this manuscript without logging in.'
                : 'Enable a public link so anyone can view this manuscript without logging in.'}
            </p>
            {shareEnabled && shareUrl && (
              <div className="flex gap-2 mb-4">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs px-3 py-2 rounded-lg font-mono"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                />
                <button onClick={handleCopyShareLink} className="dark-btn-outline px-3 py-2 text-sm rounded-lg shrink-0">
                  Copy
                </button>
              </div>
            )}
            {shareError && (
              <p className="text-xs mb-3" style={{ color: '#f87171' }}>{shareError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowShare(false)}
                className="dark-btn-outline flex-1 py-2 text-sm font-medium rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => handleToggleShare(!shareEnabled)}
                disabled={sharingLoading}
                className="dark-btn-primary flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {sharingLoading ? 'Saving...' : shareEnabled ? 'Disable sharing' : 'Enable sharing'}
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
            <ManuscriptRenderer text={manuscript} />
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
