'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Document } from '@/lib/types'

const SENTIMENT_COLORS: Record<string, string> = {
  risk: 'text-red-600 bg-red-50',
  commitment: 'text-blue-600 bg-blue-50',
  aspiration: 'text-green-600 bg-green-50',
  neutral: 'text-gray-500 bg-gray-50',
}

const WEIGHT_COLORS = (w: number) => {
  if (w >= 8) return 'text-red-700 font-bold'
  if (w >= 6) return 'text-amber-600 font-semibold'
  return 'text-gray-500'
}

export default function DocumentCard({ document: doc, projectSlug }: { document: Document; projectSlug: string }) {
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

    // Delete from storage
    await supabase.storage.from('documents').remove([doc.file_path])

    // Delete record
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
    <div className={`relative bg-white rounded-xl border p-5 transition-all ${
      isSuperseded ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
    }`}>
      {/* Action buttons — top right */}
      <div className="absolute top-3 right-3 flex gap-1.5" onClick={e => e.stopPropagation()}>
        {isProcessing && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {retrying ? 'Retrying...' : 'Retry AI'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>

      <Link href={`/projects/${projectSlug}/documents/${doc.id}`} className="block pr-24">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium text-gray-900 truncate">
                {doc.title ?? doc.file_name}
              </span>

              {isSuperseded && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  Superseded
                </span>
              )}

              {needsReview && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Needs review
                </span>
              )}

              {isProcessing && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  Awaiting full analysis
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              {doc.document_date && <span>{new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}</span>}
              {doc.source_organization && <span>{doc.source_organization}</span>}
              {doc.category && <span className="capitalize">{doc.category}</span>}
            </div>

            {doc.summary && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">{doc.summary}</p>
            )}
            {!doc.summary && (doc as any).quick_scan?.headline && (
              <p className="text-sm text-gray-400 mt-2 italic line-clamp-2">
                {(doc as any).quick_scan.headline}
              </p>
            )}

            {doc.flags && doc.flags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {doc.flags.map(flag => (
                  <span key={flag} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {doc.relevance_weight != null && (
              <div className="text-right">
                <span className={`text-lg ${WEIGHT_COLORS(doc.relevance_weight)}`}>
                  {doc.relevance_weight}
                </span>
                <span className="text-xs text-gray-400">/10</span>
              </div>
            )}
            {doc.sentiment && (
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SENTIMENT_COLORS[doc.sentiment] ?? 'bg-gray-50 text-gray-500'}`}>
                {doc.sentiment}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
