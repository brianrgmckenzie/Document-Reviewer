'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { exportManuscriptToDocx } from '@/lib/exportDocx'
import ManuscriptRenderer from '@/components/ManuscriptRenderer'
import { Copy, FileDown, Share2, Code, RefreshCw, Play, Square, Link, Headphones, Upload, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  project: { id: string; name: string; client_name: string }
  processedCount: number
  subProjectCount?: number
  initialManuscript: string | null
  manuscriptGeneratedAt: string | null
  readOnly?: boolean
  isSuperAdmin?: boolean
  initialShareToken?: string | null
  initialShareEnabled?: boolean
  initialAudioUrl?: string | null
  initialEngagementContext?: string | null
}

export default function ManuscriptClient({
  project,
  processedCount,
  subProjectCount,
  initialManuscript,
  manuscriptGeneratedAt,
  readOnly,
  isSuperAdmin,
  initialShareToken,
  initialShareEnabled,
  initialAudioUrl,
  initialEngagementContext,
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
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl ?? null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioError, setAudioError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [engagementContext, setEngagementContext] = useState(initialEngagementContext ?? '')
  const [contextExpanded, setContextExpanded] = useState(false)
  const [savingContext, setSavingContext] = useState(false)
  const [contextSaved, setContextSaved] = useState(false)
  const [contextError, setContextError] = useState('')

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
    setManuscript(null)

    const response = await fetch('/api/generate-manuscript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'Generation failed')
      setGenerating(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value, { stream: true })
      setManuscript(accumulated)
    }

    setGeneratedAt(new Date().toISOString())
    setGenerating(false)
    router.refresh()
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

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioUploading(true)
    setAudioError('')

    // Step 1: get a signed upload URL (file never touches our server)
    const ext = file.name.split('.').pop() ?? 'mp3'
    const urlRes = await fetch(`/api/projects/${project.id}/audio/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext }),
    })
    if (!urlRes.ok) {
      const body = await urlRes.json().catch(() => ({}))
      setAudioError(`Step 1 failed (${urlRes.status}): ${body.error ?? 'could not get upload URL'}`)
      setAudioUploading(false)
      e.target.value = ''
      return
    }
    const { signedUrl, publicUrl } = await urlRes.json()

    // Step 2: upload directly to Supabase Storage
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '')
      setAudioError(`Step 2 failed (${uploadRes.status}): ${text.slice(0, 120)}`)
      setAudioUploading(false)
      e.target.value = ''
      return
    }

    // Step 3: save the public URL to the project
    const saveRes = await fetch(`/api/projects/${project.id}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: publicUrl }),
    })
    if (saveRes.ok) {
      setAudioUrl(publicUrl)
    } else {
      const body = await saveRes.json().catch(() => ({}))
      setAudioError(`Step 3 failed (${saveRes.status}): ${body.error ?? 'could not save URL'}`)
    }
    setAudioUploading(false)
    e.target.value = ''
  }

  async function handleAudioDelete() {
    const response = await fetch(`/api/projects/${project.id}/audio`, { method: 'DELETE' })
    if (response.ok) setAudioUrl(null)
  }

  async function handleSaveContext() {
    setSavingContext(true)
    setContextError('')
    setContextSaved(false)
    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagement_context: engagementContext.trim() || null }),
    })
    if (response.ok) {
      setContextSaved(true)
      setTimeout(() => setContextSaved(false), 2000)
    } else {
      const body = await response.json().catch(() => ({}))
      setContextError(body.error ?? 'Failed to save')
    }
    setSavingContext(false)
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
              : `Synthesizes ${processedCount} document${processedCount !== 1 ? 's' : ''}${subProjectCount ? ` across ${subProjectCount} analysis phase${subProjectCount !== 1 ? 's' : ''}` : ''} into a consultant briefing`}
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

      {/* Engagement context */}
      {!readOnly && (
        <div className="dark-card rounded-xl p-5">
          <button
            onClick={() => setContextExpanded(e => !e)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={15} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
              <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>Engagement Context</span>
              {!contextExpanded && (
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {engagementContext.trim()
                    ? engagementContext.trim().slice(0, 100)
                    : 'Not set — paste a contract, SOW, or instructions to shape the manuscript'}
                </span>
              )}
            </div>
            {contextExpanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </button>
          {contextExpanded && (
            <div className="mt-3 space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Paste a contract addendum, SOW, or any instructions for this engagement. If it defines specific deliverables, the manuscript will be restructured to produce them; otherwise it shapes emphasis within the default structure.
              </p>
              <textarea
                value={engagementContext}
                onChange={e => setEngagementContext(e.target.value)}
                placeholder="e.g. paste the contract addendum, SOW, or describe what this engagement needs to produce..."
                maxLength={20000}
                className="dark-textarea w-full px-3 py-2 rounded-lg text-sm"
                style={{ minHeight: '180px' }}
              />
              {contextError && <p className="text-xs" style={{ color: '#f87171' }}>{contextError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveContext}
                  disabled={savingContext}
                  className="dark-btn-primary px-3 py-1.5 text-sm rounded-lg disabled:opacity-50"
                >
                  {savingContext ? 'Saving...' : 'Save'}
                </button>
                {contextSaved && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saved</span>}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Podcast audio */}
      {(isSuperAdmin || audioUrl) && manuscript && !generating && (
        <div className="dark-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Headphones size={15} style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Podcast Audio</span>
              {!audioUrl && isSuperAdmin && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload a NotebookLM audio file to share alongside this manuscript</span>
              )}
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={audioUploading}
                  className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload size={13} />
                  {audioUploading ? 'Uploading...' : audioUrl ? 'Replace' : 'Upload'}
                </button>
                {audioUrl && (
                  <button
                    onClick={handleAudioDelete}
                    className="dark-btn-outline px-2 py-1.5 text-sm rounded-lg flex items-center"
                    style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          {audioError && <p className="text-xs mb-2" style={{ color: '#f87171' }}>{audioError}</p>}
          {audioUrl ? (
            <audio controls className="w-full" src={audioUrl} style={{ accentColor: 'var(--blue)' }} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audio uploaded yet.</p>
          )}
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
        </div>
      )}

      {!readOnly && processedCount === 0 && !manuscript && (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No processed documents yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Upload and process documents before generating a manuscript.</p>
        </div>
      )}

      {generating && !manuscript && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Synthesizing {processedCount} documents...</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{processedCount > 50 ? 'Large project — first words appear in ~15 seconds' : 'First words appear in a few seconds'}</p>
        </div>
      )}

      {manuscript && (
        <div className="dark-card rounded-xl p-10">
          {view === 'rendered' || readOnly || generating ? (
            <ManuscriptRenderer text={manuscript} />
          ) : (
            <textarea
              value={manuscript}
              onChange={e => setManuscript(e.target.value)}
              className="w-full h-[70vh] font-mono text-sm border-0 outline-none resize-none"
              style={{ background: 'transparent', color: 'var(--text-secondary)' }}
            />
          )}
          {generating && (
            <div className="flex items-center gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--blue)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Writing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
