'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Document } from '@/lib/types'

function parcaColor(total: number) {
  const pct = total / 50
  if (pct >= 0.7) return 'var(--success)'
  if (pct >= 0.45) return 'var(--warning)'
  return 'var(--risk)'
}

function salienceColor(n: number) {
  if (n >= 8) return 'var(--accent)'
  if (n >= 6) return 'var(--warning)'
  return 'var(--text-muted)'
}

const SENTIMENT_STYLES: Record<string, { bg: string; color: string }> = {
  risk:       { bg: 'var(--risk-dim)',    color: 'var(--risk)' },
  commitment: { bg: 'var(--accent-dim)',  color: 'var(--accent)' },
  aspiration: { bg: 'var(--success-dim)', color: 'var(--success)' },
  neutral:    { bg: 'var(--surface-3)',   color: 'var(--text-muted)' },
}

export default function DocumentCard({
  document: doc, projectSlug, uploaderEmail, isLast,
}: {
  document: Document; projectSlug: string; uploaderEmail?: string; isLast?: boolean
}) {
  const isProcessing = !doc.ai_processed
  const isPartial = doc.ai_processed && !doc.extracted_text
  const needsReview = doc.ai_processed && !doc.human_reviewed
  const isSuperseded = !!doc.superseded_by
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${doc.title ?? doc.file_name}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRetrying(true)
    setRetryError('')
    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })
      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json().catch(() => ({}))
        const errMsg = typeof data.error === 'string' ? data.error : `Error ${response.status}`
        setRetryError(errMsg)
      }
    } catch {
      setRetryError('Network error')
    }
    setRetrying(false)
  }

  const metaParts = [
    doc.document_date ? new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' }) : null,
    doc.source_organization,
    doc.category,
    uploaderEmail ? `Uploaded by ${uploaderEmail}` : null,
  ].filter(Boolean)

  const craapTotal = (doc as unknown as { craap_total: number | null }).craap_total
  const sentStyle = doc.sentiment ? SENTIMENT_STYLES[doc.sentiment] : null

  return (
    <div
      className={isSuperseded ? 'doc-card-superseded' : 'doc-card'}
      style={{
        padding: '18px 20px',
        borderRadius: 0,
        borderLeft: 'none', borderRight: 'none', borderTop: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* Left column */}
      <Link href={`/projects/${projectSlug}/documents/${doc.id}`} style={{ textDecoration: 'none', minWidth: 0, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {doc.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 mt-0.5" style={{ border: '1px solid var(--border)' }} />
        )}
        <div className="min-w-0 flex-1">
        {/* Title + badges */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            {doc.title ?? doc.file_name}
          </span>
          {isSuperseded && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)', fontSize: 10 }}>Superseded</span>
          )}
          {needsReview && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 10 }}>Needs review</span>
          )}
          {isProcessing && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 10 }}>Processing</span>
          )}
          {isPartial && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 10 }}>Partial analysis</span>
          )}
        </div>

        {/* Metadata line */}
        {metaParts.length > 0 && (
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {metaParts.join(' · ')}
          </p>
        )}

        {/* Summary */}
        {doc.summary && (
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 600 }}>
            {doc.summary}
          </p>
        )}
        {!doc.summary && (doc as unknown as { quick_scan: { headline?: string } }).quick_scan?.headline && (
          <p className="text-xs mt-1 italic line-clamp-2" style={{ color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 600 }}>
            {(doc as unknown as { quick_scan: { headline?: string } }).quick_scan.headline}
          </p>
        )}

        {/* Topics + Flags */}
        {((doc.topics && doc.topics.length > 0) || (doc.flags && doc.flags.length > 0)) && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {(doc.topics ?? []).slice(0, 5).map(topic => (
              <span key={topic} className="doc-tag">{topic}</span>
            ))}
            {(doc.flags ?? []).map(flag => (
              <span key={flag} className="doc-tag doc-tag-risk">{flag}</span>
            ))}
          </div>
        )}
        </div>
      </Link>

      {/* Right column */}
      <div className="flex flex-col items-end gap-2 shrink-0" onClick={e => e.stopPropagation()}>
        {doc.relevance_weight != null && (
          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Salience</p>
            <span style={{ fontFamily: 'var(--font-space-mono)', color: salienceColor(doc.relevance_weight) }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{doc.relevance_weight}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>
            </span>
          </div>
        )}

        {sentStyle && (
          <span className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: sentStyle.bg, color: sentStyle.color, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {doc.sentiment}
          </span>
        )}

        {craapTotal != null && (
          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>PARCA</p>
            <span style={{ fontFamily: 'var(--font-space-mono)', color: parcaColor(craapTotal) }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{craapTotal}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/50</span>
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-1">
          {(isProcessing || isPartial) && (
            <button onClick={handleRetry} disabled={retrying} className="dark-btn-danger px-2.5" style={{ height: 24, fontSize: 11 }}>
              {retrying ? 'Processing…' : 'Retry AI'}
            </button>
          )}
          <button onClick={handleDelete} disabled={deleting} className="dark-btn-danger px-2.5" style={{ height: 24, fontSize: 11 }}>
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
        {retryError && (
          <p className="text-xs mt-1 max-w-[160px] text-right" style={{ color: 'var(--risk)' }}>{retryError}</p>
        )}
      </div>
    </div>
  )
}
