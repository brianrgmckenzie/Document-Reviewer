import React from 'react'

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function renderManuscript(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold mb-6 pb-4" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-8 mb-3" style={{ color: 'var(--text-primary)' }}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2" style={{ color: 'var(--text-secondary)' }}>{renderInline(line.slice(4))}</h3>)
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} className="flex gap-3 mb-2">
          <span className="shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>{line.match(/^\d+/)![0]}.</span>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderInline(line.replace(/^\d+\.\s/, ''))}</p>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-3 mb-1.5 ml-2">
          <span className="shrink-0 mt-1.5" style={{ color: 'var(--text-muted)' }}>•</span>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderInline(line.slice(2))}</p>
        </div>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="my-6" style={{ borderColor: 'var(--border)' }} />)
    } else if (line.startsWith('*') && line.endsWith('*')) {
      elements.push(<p key={i} className="text-xs italic mt-4" style={{ color: 'var(--text-muted)' }}>{line.replace(/^\*|\*$/g, '')}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="leading-relaxed mb-1" style={{ color: 'var(--text-secondary)' }}>{renderInline(line)}</p>)
    }
  })

  return elements
}

export default function ManuscriptRenderer({ text }: { text: string }) {
  return <div className="prose-reframe">{renderManuscript(text)}</div>
}
