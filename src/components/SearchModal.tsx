'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const SENTIMENT_COLORS: Record<string, string> = {
  risk: 'text-red-600 bg-red-50',
  commitment: 'text-blue-600 bg-blue-50',
  aspiration: 'text-green-600 bg-green-50',
  neutral: 'text-gray-500 bg-gray-50',
}

interface SearchResult {
  id: string
  title: string | null
  file_name: string
  summary: string | null
  topics: string[] | null
  chief_concerns: string[] | null
  category: string | null
  authority_tier_label: string | null
  document_date: string | null
  craap_total: number | null
  sentiment: string | null
  flags: string[] | null
  _score: number
  _matchedTerms: string[]
}

interface Props {
  projectId: string
  projectSlug: string
  suppressedWords: string[]
}

function highlight(text: string, terms: string[]): React.ReactNode {
  if (!terms.length || !text) return text
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark> : part
  )
}

export default function SearchModal({ projectId, projectSlug, suppressedWords: initialSuppressed }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [filteredQuery, setFilteredQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [suppressed, setSuppressed] = useState<string[]>(initialSuppressed)
  const [newWord, setNewWord] = useState('')
  const [showSuppress, setShowSuppress] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearched(false)

    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, query }),
    })

    const data = await response.json()
    setResults(data.results ?? [])
    setFilteredQuery(data.filteredQuery ?? '')
    setSearching(false)
    setSearched(true)
  }

  async function addSuppressedWord() {
    const word = newWord.trim().toLowerCase()
    if (!word || suppressed.includes(word)) { setNewWord(''); return }
    const updated = [...suppressed, word]
    setSuppressed(updated)
    setNewWord('')
    await supabase.from('projects').update({ search_suppressed_words: updated }).eq('id', projectId)
  }

  async function removeSuppressedWord(word: string) {
    const updated = suppressed.filter(w => w !== word)
    setSuppressed(updated)
    await supabase.from('projects').update({ search_suppressed_words: updated }).eq('id', projectId)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
      >
        Search
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-16 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-3 p-4 border-b border-gray-100">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search documents by topic, concern, or keyword..."
                className="flex-1 text-sm text-gray-900 outline-none placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setQuery(''); setResults([]); setSearched(false) }}
                className="text-gray-400 hover:text-gray-700 text-lg font-light px-1"
              >
                ✕
              </button>
            </form>

            {/* Filtered query indicator */}
            {searched && filteredQuery && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                Searching for: <span className="font-medium text-gray-700">{filteredQuery}</span>
                {filteredQuery !== query.toLowerCase() && ' (stop words removed)'}
              </div>
            )}

            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {searched && results.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No documents matched &quot;{filteredQuery || query}&quot;
                </div>
              )}

              {results.map(doc => (
                <Link
                  key={doc.id}
                  href={`/projects/${projectSlug}/documents/${doc.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="font-medium text-gray-900 text-sm">
                      {highlight(doc.title ?? doc.file_name, doc._matchedTerms)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.craap_total != null && (
                        <span className="text-xs text-gray-400">PARCA {doc.craap_total}/50</span>
                      )}
                      {doc.sentiment && (
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SENTIMENT_COLORS[doc.sentiment] ?? 'bg-gray-50 text-gray-500'}`}>
                          {doc.sentiment}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs text-gray-400 mb-1.5 flex-wrap">
                    {doc.authority_tier_label && <span>{doc.authority_tier_label}</span>}
                    {doc.category && <span className="capitalize">{doc.category}</span>}
                    {doc.document_date && <span>{new Date(doc.document_date).getFullYear()}</span>}
                  </div>

                  {doc.summary && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {highlight(doc.summary, doc._matchedTerms)}
                    </p>
                  )}

                  {doc.topics && doc.topics.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {doc.topics.slice(0, 6).map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${doc._matchedTerms.some(m => t.toLowerCase().includes(m)) ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Footer: suppress words */}
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => setShowSuppress(s => !s)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {showSuppress ? 'Hide' : 'Manage'} suppressed words ({suppressed.length} custom)
              </button>

              {showSuppress && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={newWord}
                      onChange={e => setNewWord(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSuppressedWord()}
                      placeholder="Add word to suppress..."
                      className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      onClick={addSuppressedWord}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                  {suppressed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {suppressed.map(w => (
                        <span key={w} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                          {w}
                          <button onClick={() => removeSuppressedWord(w)} className="text-gray-400 hover:text-red-500">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
