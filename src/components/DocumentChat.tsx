'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SaveState {
  messageIndex: number
  text: string
}

interface Props {
  documentId: string
  projectId: string
}

export default function DocumentChat({ documentId, projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<SaveState | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const history = [...messages, userMessage]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/documents/${documentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok) throw new Error('Request failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages([...history, { role: 'assistant', content: assistantText }])
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!saving || saving.text.length > 500 || !saving.text.trim()) return
    setSaveError('')

    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: JSON.stringify({ _ai: true, text: saving.text.trim() }), projectId }),
    })

    if (res.ok) {
      const { comment } = await res.json()
      window.dispatchEvent(new CustomEvent('doc:comment:saved', { detail: comment }))
      setSaving(null)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } else {
      const data = await res.json()
      setSaveError(data.error ?? 'Failed to save')
    }
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Ask This Document
      </h3>

      {/* Message area */}
      {messages.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Ask a question about this document. Answers are drawn only from its contents.
        </p>
      ) : (
        <div className="space-y-4 mb-4 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="flex items-center justify-center rounded-lg text-xs font-bold shrink-0 mt-0.5"
                    style={{ width: 20, height: 20, background: 'linear-gradient(145deg,#3b82f6,#2563eb)', color: 'white', fontSize: 8, fontWeight: 700, boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
                    AI
                  </div>
                )}
                <div className={`flex-1 flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className="text-sm px-3 py-2.5 max-w-prose whitespace-pre-wrap"
                    style={{
                      background: m.role === 'user' ? 'linear-gradient(145deg,#3b82f6,#2563eb)' : 'rgba(255,255,255,0.80)',
                      border: m.role === 'user' ? 'none' : '1px solid rgba(180,190,220,0.30)',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                      boxShadow: m.role === 'user' ? '0 3px 12px rgba(37,99,235,0.25)' : '0 1px 0 rgba(255,255,255,0.90) inset, 0 2px 8px rgba(100,120,180,0.08)',
                      minHeight: '2rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {m.content || (loading && m.role === 'assistant'
                      ? <span style={{ color: 'var(--text-muted)' }}>Thinking…</span>
                      : null
                    )}
                  </div>
                  {m.role === 'assistant' && m.content && (
                    <button
                      onClick={() => { setSaving({ messageIndex: i, text: m.content }); setSaveError('') }}
                      className="text-xs px-3 py-1 rounded-full transition-all"
                      style={{ background: 'rgba(100,120,180,0.07)', border: '1px solid rgba(180,190,220,0.25)', color: 'var(--text-secondary)' }}
                    >
                      Save finding to comments
                    </button>
                  )}
                </div>
              </div>

              {saving?.messageIndex === i && (
                <div className="mt-3 ml-7 p-3 rounded-xl" style={{ background: 'rgba(100,120,180,0.05)', border: '1px solid rgba(180,190,220,0.18)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    Edit before saving — 500 character limit
                  </p>
                  <textarea
                    value={saving.text}
                    onChange={e => setSaving({ ...saving, text: e.target.value })}
                    rows={4}
                    className="dark-textarea w-full px-3 py-2 rounded-lg text-sm"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: saving.text.length > 500 ? 'var(--risk)' : 'var(--text-muted)' }}>
                      {saving.text.length}/500
                      {saving.text.length > 500 && ' — please shorten'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => { setSaving(null); setSaveError('') }} className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                      <button onClick={handleSave} disabled={saving.text.length > 500 || !saving.text.trim()} className="dark-btn-primary text-xs px-3 py-1" style={{ height: 28 }}>Save</button>
                    </div>
                  </div>
                  {saveError && <p className="text-xs mt-1" style={{ color: 'var(--risk)' }}>{saveError}</p>}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {saveSuccess && <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>Finding saved to comments.</p>}
      {error && <p className="text-xs mb-3" style={{ color: 'var(--risk)' }}>{error}</p>}

      {/* Input row */}
      <div style={{ borderTop: messages.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: messages.length > 0 ? 12 : 0 }}>
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask something about this document…"
            disabled={loading}
            rows={2}
            className="dark-textarea flex-1 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ resize: 'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as unknown as React.FormEvent)
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="dark-btn-primary px-4 shrink-0"
            style={{ height: 38, alignSelf: 'flex-end' }}
          >
            {loading ? '…' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
