'use client'

import { useState, useEffect, useRef } from 'react'

interface Comment {
  id: string
  user_email: string
  body: string
  created_at: string
}

interface Props {
  documentId: string
  projectId: string
  currentUserEmail: string
}

export default function DocumentComments({ documentId, projectId, currentUserEmail }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadComments() {
    const res = await fetch(`/api/documents/${documentId}/comments`)
    const data = await res.json()
    setComments(data.comments ?? [])
    setLoading(false)
  }

  useEffect(() => { loadComments() }, [documentId])

  useEffect(() => {
    function onAiComment(e: Event) {
      const comment = (e as CustomEvent).detail as Comment
      setComments(prev => [...prev, comment])
    }
    window.addEventListener('doc:comment:saved', onAiComment)
    return () => window.removeEventListener('doc:comment:saved', onAiComment)
  }, [])

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  async function handleDelete(commentId: string) {
    setDeleting(commentId)
    const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
    }
    setDeleting(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError('')

    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, projectId }),
    })

    if (res.ok) {
      const { comment } = await res.json()
      setComments(prev => [...prev, comment])
      setBody('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to post comment')
    }
    setSubmitting(false)
  }

  return (
    <div className="dark-card rounded-xl p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Comments & Context
      </h3>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No comments yet. Add context or questions below.</p>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map(c => {
            const isMe = c.user_email === currentUserEmail
            let displayBody = c.body
            let isAiFinding = false
            try {
              const parsed = JSON.parse(c.body)
              if (parsed._ai === true) { displayBody = parsed.text; isAiFinding = true }
            } catch { /* plain text */ }
            const authorLabel = isMe ? (isAiFinding ? 'AI and You' : 'You') : c.user_email
            return (
              <div key={c.id} className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                  style={{ background: isMe ? 'var(--blue-dim)' : 'var(--surface-raised)', color: isMe ? 'var(--blue)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {c.user_email[0].toUpperCase()}
                </div>
                <div className={`flex-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {authorLabel}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-muted)' }}
                        title="Delete comment"
                      >
                        {deleting === c.id ? '...' : '✕'}
                      </button>
                    )}
                  </div>
                  <div
                    className="text-sm px-3 py-2 rounded-xl max-w-prose"
                    style={{
                      background: isMe ? 'var(--blue-dim)' : 'var(--surface-raised)',
                      border: `1px solid ${isMe ? 'rgba(59,130,246,0.2)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {displayBody}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment or context..."
          className="dark-input flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any) } }}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
        >
          {submitting ? '...' : 'Send'}
        </button>
      </form>

      {error && (
        <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  )
}
