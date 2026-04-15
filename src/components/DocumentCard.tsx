'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Document } from '@/lib/types'

export default function DocumentCard({ document: doc, projectSlug, uploaderEmail }: { document: Document; projectSlug: string; uploaderEmail?: string }) {
  const isProcessing = !doc.ai_processed
  const needsReview = doc.ai_processed && !doc.human_reviewed
  const isSuperseded = !!doc.superseded_by
  const [retrying, setRetrying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete "${doc.title ?? doc.file_name}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    setRetrying(true)
    const response = await fetch('/api/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id }),
    })
    setRetrying(false)
    if (response.ok) router.refresh()
  }

  return (
    <div
      className="doc-card relative rounded-xl p-5 transition-all"
      style={isSuperseded ? { opacity: 0.5 } : {}}
    >
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1.5" onClick={e => e.stopPropagation()}>
        {isProcessing && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
          >
            {retrying ? 'Retrying...' : 'Retry AI'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>

      <Link href={`/projects/${projectSlug}/documents/${doc.id}`} className="block pr-24">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {doc.title ?? doc.file_name}
              </span>

              {isSuperseded && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
                  Superseded
                </span>
              )}
              {needsReview && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                  Needs review
                </span>
              )}
              {isProcessing && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                  Processing
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {doc.document_date && <span>{new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}</span>}
              {doc.source_organization && <span>{doc.source_organization}</span>}
              {doc.category && <span className="capitalize">{doc.category}</span>}
              {uploaderEmail && <span>Uploaded by {uploaderEmail}</span>}
            </div>

            {doc.summary && (
              <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{doc.summary}</p>
            )}
            {!doc.summary && (doc as any).quick_scan?.headline && (
              <p className="text-sm mt-2 italic line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {(doc as any).quick_scan.headline}
              </p>
            )}

            {doc.flags && doc.flags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {doc.flags.map(flag => (
                  <span key={flag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {doc.relevance_weight != null && (
              <div className="text-right">
                <span className="text-lg font-semibold" style={{ color: doc.relevance_weight >= 8 ? '#f87171' : doc.relevance_weight >= 6 ? '#fbbf24' : 'var(--text-muted)' }}>
                  {doc.relevance_weight}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/10</span>
              </div>
            )}
            {doc.sentiment && (
              <span
                className="text-xs px-2 py-0.5 rounded-full capitalize"
                style={{
                  background: doc.sentiment === 'risk' ? 'rgba(239,68,68,0.15)' : doc.sentiment === 'commitment' ? 'var(--blue-dim)' : doc.sentiment === 'aspiration' ? 'rgba(34,197,94,0.15)' : 'var(--surface-raised)',
                  color: doc.sentiment === 'risk' ? '#f87171' : doc.sentiment === 'commitment' ? 'var(--blue)' : doc.sentiment === 'aspiration' ? '#4ade80' : 'var(--text-muted)',
                }}
              >
                {doc.sentiment}
              </span>
            )}
            {(doc as any).craap_total != null && (
              <div className="text-right">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{(doc as any).craap_total}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/50</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
