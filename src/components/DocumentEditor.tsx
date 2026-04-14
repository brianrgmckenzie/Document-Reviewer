'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AUTHORITY_TIER_LABELS,
  AUTHORITY_TIER_DESCRIPTIONS,
  DOCUMENT_CATEGORIES,
  SENTIMENT_OPTIONS,
  type Document,
  type AuthorityTier,
  type DocumentCategory,
  type Sentiment,
} from '@/lib/types'
import CRAAPEditor from '@/components/CRAAPEditor'

const TIER_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-800 border-purple-200',
  2: 'bg-blue-100 text-blue-800 border-blue-200',
  3: 'bg-green-100 text-green-800 border-green-200',
  4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  5: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function DocumentEditor({ document: doc, projectSlug, role }: { document: Document; projectSlug: string; role?: string | null }) {
  const isSuperAdmin = role === 'super_admin' || role == null
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [craap, setCraap] = useState({
    craap_currency: (doc as any).craap_currency ?? 5,
    craap_relevance: (doc as any).craap_relevance ?? 5,
    craap_authority: (doc as any).craap_authority ?? 5,
    craap_completeness: (doc as any).craap_completeness ?? 5,
    craap_purpose: (doc as any).craap_purpose ?? 5,
  })
  const [form, setForm] = useState({
    title: doc.title ?? '',
    document_date: doc.document_date ?? '',
    author: doc.author ?? '',
    source_organization: doc.source_organization ?? '',
    authority_tier: doc.authority_tier ?? 4,
    category: doc.category ?? 'other',
    relevance_weight: doc.relevance_weight ?? 5,
    summary: doc.summary ?? '',
    chief_concerns: ((doc as any).chief_concerns ?? []).join('\n'),
    consultant_notes: ((doc as any).consultant_notes ?? []).join('\n'),
    key_extracts: (doc.key_extracts ?? []).join('\n'),
    topics: (doc.topics ?? []).join(', '),
    sentiment: doc.sentiment ?? 'neutral',
    flags: (doc.flags ?? []).join(', '),
  })

  const supabase = createClient()
  const router = useRouter()

  async function handleSaveCRAAPOnly() {
    setSaving(true)
    setSaveError('')
    const craapTotal = craap.craap_currency + craap.craap_relevance + craap.craap_authority + craap.craap_completeness + craap.craap_purpose
    const { error } = await supabase
      .from('documents')
      .update({
        craap_currency: craap.craap_currency,
        craap_relevance: craap.craap_relevance,
        craap_authority: craap.craap_authority,
        craap_completeness: craap.craap_completeness,
        craap_purpose: craap.craap_purpose,
        craap_total: craapTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    setSaving(false)
    if (error) {
      setSaveError(`Save failed: ${error.message}`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
  }

  // Stripped view for project_admin
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 text-sm">{doc.title ?? doc.file_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{doc.file_name}</p>
          </div>
          <button
            onClick={handleSaveCRAAPOnly}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save CRAAP Scores'}
          </button>
        </div>
        {saveError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-sm text-red-600">{saveError}</div>
        )}
        {doc.summary && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Summary</h3>
            <p className="text-sm text-gray-600">{doc.summary}</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">CRAAP Score</h3>
          <p className="text-xs text-gray-400 mb-5">Adjust based on your judgment.</p>
          <CRAAPEditor
            scores={craap}
            weights={(doc as any).project_craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }}
            onChange={setCraap}
          />
        </div>
      </div>
    )
  }

  async function handleRetryAI() {
    setRetrying(true)
    setRetryError('')
    const response = await fetch('/api/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id }),
    })
    if (response.ok) {
      router.refresh()
    } else {
      const data = await response.json()
      setRetryError(data.error ?? 'Retry failed')
    }
    setRetrying(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const tier = Number(form.authority_tier) as AuthorityTier
    const craapTotal = craap.craap_currency + craap.craap_relevance + craap.craap_authority + craap.craap_completeness + craap.craap_purpose

    const { error } = await supabase
      .from('documents')
      .update({
        title: form.title || null,
        document_date: form.document_date || null,
        author: form.author || null,
        source_organization: form.source_organization || null,
        authority_tier: tier,
        authority_tier_label: AUTHORITY_TIER_LABELS[tier],
        category: form.category as DocumentCategory,
        relevance_weight: Number(form.relevance_weight),
        craap_currency: craap.craap_currency,
        craap_relevance: craap.craap_relevance,
        craap_authority: craap.craap_authority,
        craap_completeness: craap.craap_completeness,
        craap_purpose: craap.craap_purpose,
        craap_total: craapTotal,
        summary: form.summary || null,
        chief_concerns: form.chief_concerns.split('\n').filter(Boolean),
        consultant_notes: form.consultant_notes.split('\n').filter(Boolean),
        key_extracts: form.key_extracts.split('\n').filter(Boolean),
        topics: form.topics.split(',').map(t => t.trim()).filter(Boolean),
        sentiment: form.sentiment as Sentiment,
        flags: form.flags.split(',').map(f => f.trim()).filter(Boolean),
        human_reviewed: true,
        human_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    setSaving(false)
    if (error) {
      setSaveError(`Save failed: ${error.message}`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
  }

  const tier = Number(form.authority_tier) as AuthorityTier

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          {doc.ai_processed ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700">AI Assessed</span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Processing...</span>
          )}
          {doc.human_reviewed ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Human Reviewed</span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Pending Review</span>
          )}
          <span className="text-xs text-gray-400">{doc.file_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetryAI}
            disabled={retrying}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {retrying ? 'Re-processing...' : 'Retry AI'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
      {retryError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-sm text-red-600">{retryError}</div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-sm text-red-600">{saveError}</div>
      )}

      {/* Core metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Document Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Document Date</label>
            <input
              type="date"
              value={form.document_date}
              onChange={e => setForm({ ...form, document_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as DocumentCategory })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {DOCUMENT_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Author</label>
            <input
              value={form.author}
              onChange={e => setForm({ ...form, author: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source Organization</label>
            <input
              value={form.source_organization}
              onChange={e => setForm({ ...form, source_organization: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
      </div>

      {/* CRAAP Scores */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">CRAAP Score</h3>
        <p className="text-xs text-gray-400 mb-5">AI-generated — adjust based on your judgment. Weights are set at the project level.</p>
        <CRAAPEditor
          scores={craap}
          weights={(doc as any).project_craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }}
          onChange={setCraap}
        />
      </div>

      {/* AI Assessment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">AI Assessment</h3>

        {/* Authority Tier */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-2">Authority Tier</label>
          <div className="flex gap-2 flex-wrap">
            {([1, 2, 3, 4, 5] as AuthorityTier[]).map(t => (
              <button
                key={t}
                onClick={() => setForm({ ...form, authority_tier: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  form.authority_tier === t
                    ? TIER_COLORS[t]
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {t} — {AUTHORITY_TIER_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {AUTHORITY_TIER_DESCRIPTIONS[tier]}
          </p>
        </div>

        {/* Relevance Weight */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-2">
            Relevance Weight: <span className="font-bold text-gray-700">{form.relevance_weight}/10</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={form.relevance_weight}
            onChange={e => setForm({ ...form, relevance_weight: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 — Peripheral</span>
            <span>10 — Critical</span>
          </div>
        </div>

        {/* Sentiment */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-2">Sentiment</label>
          <div className="flex gap-2">
            {SENTIMENT_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setForm({ ...form, sentiment: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${
                  form.sentiment === s
                    ? s === 'risk' ? 'bg-red-100 text-red-700 border-red-200'
                    : s === 'commitment' ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : s === 'aspiration' ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">Summary</label>
          <textarea
            value={form.summary}
            onChange={e => setForm({ ...form, summary: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {/* Chief Concerns */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Chief Concerns <span className="text-gray-400">(one per line)</span>
          </label>
          <textarea
            value={form.chief_concerns}
            onChange={e => setForm({ ...form, chief_concerns: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {/* Consultant Notes */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Consultant Notes <span className="text-gray-400">(one per line)</span>
          </label>
          <textarea
            value={form.consultant_notes}
            onChange={e => setForm({ ...form, consultant_notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {/* Key Extracts */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Key Extracts <span className="text-gray-400">(one per line)</span>
          </label>
          <textarea
            value={form.key_extracts}
            onChange={e => setForm({ ...form, key_extracts: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {/* Topics */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Topics <span className="text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={form.topics}
            onChange={e => setForm({ ...form, topics: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Flags */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Flags <span className="text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={form.flags}
            onChange={e => setForm({ ...form, flags: e.target.value })}
            placeholder="e.g. high-priority, requires-legal-review, outdated"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Named Entities (read-only display for now) */}
      {doc.named_entities && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Named Entities</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(doc.named_entities).map(([key, values]) => {
              if (!Array.isArray(values) || values.length === 0) return null
              return (
                <div key={key}>
                  <p className="text-xs font-medium text-gray-500 capitalize mb-1">{key}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v: string) => (
                      <span key={v} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{v}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Key Numbers (read-only display) */}
      {doc.key_numbers && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Key Numbers</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(doc.key_numbers).map(([key, values]) => {
              if (!Array.isArray(values) || values.length === 0) return null
              return (
                <div key={key}>
                  <p className="text-xs font-medium text-gray-500 capitalize mb-1">{key}</p>
                  <ul className="space-y-1">
                    {values.map((v: string) => (
                      <li key={v} className="text-sm text-gray-700">{v}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
