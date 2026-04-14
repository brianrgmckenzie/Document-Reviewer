'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { exportManuscriptToDocx } from '@/lib/exportDocx'

interface Props {
  project: { id: string; name: string; client_name: string }
  processedCount: number
  initialManuscript: string | null
  manuscriptGeneratedAt: string | null
}

// Simple markdown renderer for the manuscript
function renderManuscript(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold text-gray-900 mt-8 mb-3">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-2">{line.slice(4)}</h3>)
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} className="flex gap-3 mb-2">
          <span className="text-gray-400 shrink-0 font-medium">{line.match(/^\d+/)![0]}.</span>
          <p className="text-gray-700 leading-relaxed">{line.replace(/^\d+\.\s/, '')}</p>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-3 mb-1.5 ml-2">
          <span className="text-gray-400 shrink-0 mt-1.5">•</span>
          <p className="text-gray-700 leading-relaxed">{line.slice(2)}</p>
        </div>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="border-gray-200 my-6" />)
    } else if (line.startsWith('*') && line.endsWith('*')) {
      elements.push(<p key={i} className="text-xs text-gray-400 italic mt-4">{line.replace(/^\*|\*$/g, '')}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="text-gray-700 leading-relaxed mb-1">{line}</p>)
    }
  })

  return elements
}

export default function ManuscriptClient({ project, processedCount, initialManuscript, manuscriptGeneratedAt }: Props) {
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Intake Manuscript</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Synthesizes {processedCount} processed document{processedCount !== 1 ? 's' : ''} into a consultant briefing
            {generatedAt && (
              <span className="text-gray-400"> · Last generated {new Date(generatedAt).toLocaleString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {manuscript && (
            <>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Copy
              </button>
              <button
                onClick={handleExportDocx}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Export .docx
              </button>
              <button
                onClick={() => setView(v => v === 'rendered' ? 'raw' : 'rendered')}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {view === 'rendered' ? 'Raw' : 'Rendered'}
              </button>
            </>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={generating || processedCount === 0}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : manuscript ? 'Regenerate' : 'Generate Manuscript'}
          </button>
        </div>
      </div>

      {/* CRAAP confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Before you generate</h3>
            <p className="text-sm text-gray-600 mb-4">
              The manuscript is built on your CRAAP scores. Higher-scored documents will carry more weight in the synthesis. Please confirm you've completed this work before proceeding.
            </p>
            <ul className="space-y-3 mb-6">
              {[
                'All documents have been AI-processed',
                'CRAAP scores have been reviewed and adjusted for each document',
                'Project-level CRAAP dimension weights reflect this engagement\'s priorities',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0 text-xs font-bold text-gray-400">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Not yet — go back
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
              >
                Yes — generate
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600">{error}</div>
      )}

      {processedCount === 0 && !manuscript && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No processed documents yet.</p>
          <p className="text-sm text-gray-400 mt-1">Upload and process documents before generating a manuscript.</p>
        </div>
      )}

      {generating && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Synthesizing {processedCount} documents...</p>
          <p className="text-sm text-gray-400 mt-1">This takes 30–60 seconds</p>
        </div>
      )}

      {manuscript && !generating && (
        <div className="bg-white rounded-xl border border-gray-200 p-10">
          {view === 'rendered' ? (
            <div className="prose-reframe">
              {renderManuscript(manuscript)}
            </div>
          ) : (
            <textarea
              value={manuscript}
              onChange={e => setManuscript(e.target.value)}
              className="w-full h-[70vh] font-mono text-sm text-gray-800 border-0 outline-none resize-none"
            />
          )}
        </div>
      )}
    </div>
  )
}
