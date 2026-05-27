'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Play, Square, Code } from 'lucide-react'
import ManuscriptRenderer from '@/components/ManuscriptRenderer'

interface Props {
  manuscript: string
  audioUrl: string | null
}

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

export default function ShareClient({ manuscript, audioUrl }: Props) {
  const [view, setView] = useState<'rendered' | 'raw'>('rendered')
  const [listening, setListening] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(manuscript)
  }

  function handleListen() {
    if (listening) {
      window.speechSynthesis.cancel()
      setListening(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(manuscript))
    utterance.rate = 0.95
    utterance.onend = () => setListening(false)
    utterance.onerror = () => setListening(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setListening(true)
  }

  return (
    <div className="space-y-6">
      <div className="dark-card rounded-xl p-4 flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
        >
          <Copy size={14} />
          Copy
        </button>
        <button
          onClick={handleListen}
          className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
          style={listening ? { color: 'var(--blue)', borderColor: 'var(--blue)' } : {}}
        >
          {listening ? <Square size={14} /> : <Play size={14} />}
          {listening ? 'Stop' : 'Listen'}
        </button>
        <button
          onClick={() => setView(v => v === 'rendered' ? 'raw' : 'rendered')}
          className="dark-btn-outline px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5"
        >
          <Code size={14} />
          {view === 'rendered' ? 'Raw' : 'Rendered'}
        </button>
      </div>

      {audioUrl && (
        <div className="dark-card rounded-xl p-5">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>PODCAST AUDIO</p>
          <audio controls className="w-full" src={audioUrl} />
        </div>
      )}

      <div className="dark-card rounded-xl p-10">
        {view === 'rendered' ? (
          <ManuscriptRenderer text={manuscript} />
        ) : (
          <pre className="w-full font-mono text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{manuscript}</pre>
        )}
      </div>
    </div>
  )
}
