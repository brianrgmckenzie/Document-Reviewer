'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BriefingEditor from '@/components/BriefingEditor'
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
import DocumentChat from '@/components/DocumentChat'
import DocumentComments from '@/components/DocumentComments'

const TIER_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  2: { bg: 'var(--accent-dim)',     color: 'var(--accent)' },
  3: { bg: 'var(--purple-dim)',     color: 'var(--purple)' },
  4: { bg: 'var(--warning-dim)',    color: 'var(--warning)' },
  5: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}

const SENTIMENT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  risk:       { bg: 'var(--risk-dim)',    color: 'var(--risk)',    border: 'rgba(255,77,77,0.25)' },
  commitment: { bg: 'var(--accent-dim)',  color: 'var(--accent)',  border: 'rgba(79,124,255,0.25)' },
  aspiration: { bg: 'var(--success-dim)', color: 'var(--success)', border: 'rgba(45,216,138,0.25)' },
  neutral:    { bg: 'var(--surface-3)',   color: 'var(--text-secondary)', border: 'var(--border)' },
}

type Tab = 'parca' | 'assessment' | 'entities' | 'chat'

export default function DocumentEditor({
  document: doc, role,
  documentId, projectId, currentUserEmail,
}: {
  document: Document; projectSlug: string; role?: string | null
  documentId?: string; projectId?: string; currentUserEmail?: string
}) {
  const isSuperAdmin = role === 'super_admin' || role == null
  const [activeTab, setActiveTab] = useState<Tab>('parca')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [craap, setCraap] = useState({
    craap_currency:     (doc as unknown as { craap_currency: number }).craap_currency     ?? 5,
    craap_relevance:    (doc as unknown as { craap_relevance: number }).craap_relevance    ?? 5,
    craap_authority:    (doc as unknown as { craap_authority: number }).craap_authority    ?? 5,
    craap_completeness: (doc as unknown as { craap_completeness: number }).craap_completeness ?? 5,
    craap_purpose:      (doc as unknown as { craap_purpose: number }).craap_purpose      ?? 5,
  })
  const [form, setForm] = useState({
    title:               doc.title ?? '',
    document_date:       doc.document_date ?? '',
    author:              doc.author ?? '',
    source_organization: doc.source_organization ?? '',
    authority_tier:      doc.authority_tier ?? 4,
    category:            doc.category ?? 'other',
    relevance_weight:    doc.relevance_weight ?? 5,
    briefing:            doc.summary ?? '',
    key_extracts:        (doc.key_extracts ?? []).map(e =>
      typeof e === 'string' ? { quote: e, significance: '' } : e
    ) as { quote: string; significance: string }[],
    topics:              (doc.topics ?? []).join(', '),
    sentiment:           doc.sentiment ?? 'neutral',
    flags:               (doc.flags ?? []).join(', '),
  })

  const supabase = createClient()
  const router = useRouter()

  async function handleSaveCRAAPOnly() {
    setSaving(true); setSaveError('')
    const craapTotal = craap.craap_currency + craap.craap_relevance + craap.craap_authority + craap.craap_completeness + craap.craap_purpose
    const { error } = await supabase.from('documents').update({
      craap_currency: craap.craap_currency, craap_relevance: craap.craap_relevance,
      craap_authority: craap.craap_authority, craap_completeness: craap.craap_completeness,
      craap_purpose: craap.craap_purpose, craap_total: craapTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id)
    setSaving(false)
    if (error) { setSaveError(`Save failed: ${error.message}`) }
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }
  }

  // ── Stripped view for project_admin ───────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="space-y-5">
        <div className="dark-card p-5 flex items-center justify-between" style={{ borderRadius: 12 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{doc.title ?? doc.file_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{doc.file_name}</p>
          </div>
          <button onClick={handleSaveCRAAPOnly} disabled={saving} className="dark-btn-primary px-4">
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save PARCA Scores'}
          </button>
        </div>
        {saveError && <p className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--risk-dim)', color: 'var(--risk)' }}>{saveError}</p>}
        {doc.summary && (
          <div className="dark-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <p className="text-xs font-semibold uppercase tracking-wider px-6 pt-5 pb-3" style={{ color: 'var(--text-muted)' }}>Briefing Document</p>
            <BriefingEditor content={doc.summary} onChange={() => {}} readOnly />
          </div>
        )}
        <div className="dark-card p-6" style={{ borderRadius: 12 }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>PARCA Score</h3>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Adjust based on your judgment.</p>
          <CRAAPEditor
            scores={craap}
            weights={(doc as unknown as { project_craap_weights: Record<string, number> }).project_craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }}
            aiScores={(doc as unknown as { craap_ai_scores: Record<string, number> }).craap_ai_scores}
            onChange={setCraap}
          />
        </div>
      </div>
    )
  }

  async function handleRetryAI() {
    setRetrying(true); setRetryError('')
    const response = await fetch('/api/process-document', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id }),
    })
    if (response.ok) { router.refresh() }
    else { const data = await response.json(); setRetryError(data.error ?? 'Retry failed') }
    setRetrying(false)
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    const tier = Number(form.authority_tier) as AuthorityTier
    const craapTotal = craap.craap_currency + craap.craap_relevance + craap.craap_authority + craap.craap_completeness + craap.craap_purpose
    const { error } = await supabase.from('documents').update({
      title: form.title || null, document_date: form.document_date || null,
      author: form.author || null, source_organization: form.source_organization || null,
      authority_tier: tier, authority_tier_label: AUTHORITY_TIER_LABELS[tier],
      category: form.category as DocumentCategory,
      relevance_weight: Number(form.relevance_weight),
      craap_currency: craap.craap_currency, craap_relevance: craap.craap_relevance,
      craap_authority: craap.craap_authority, craap_completeness: craap.craap_completeness,
      craap_purpose: craap.craap_purpose, craap_total: craapTotal,
      summary: form.briefing || null,
      key_extracts: form.key_extracts.filter(e => e.quote.trim()),
      topics: form.topics.split(',').map(t => t.trim()).filter(Boolean),
      sentiment: form.sentiment as Sentiment,
      flags: form.flags.split(',').map(f => f.trim()).filter(Boolean),
      human_reviewed: true, human_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id)
    setSaving(false)
    if (error) { setSaveError(`Save failed: ${error.message}`) }
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }
  }

  const tier = Number(form.authority_tier) as AuthorityTier

  const TABS: { id: Tab; label: string }[] = [
    { id: 'parca',      label: 'PARCA Scores' },
    { id: 'assessment', label: 'AI Assessment' },
    { id: 'entities',   label: 'Entities' },
    { id: 'chat',       label: 'Chat' },
  ]

  return (
    <div className="dark-card" style={{ borderRadius: 14 }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          {doc.ai_processed && doc.extracted_text ? (
            <span className="text-xs px-2.5 py-1 rounded" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>AI Assessed</span>
          ) : doc.ai_processed ? (
            <span className="text-xs px-2.5 py-1 rounded" title="Processed before full-text extraction was enabled. Retry AI for a complete assessment." style={{ background: 'var(--warning-dim)', color: 'var(--warning)', cursor: 'help' }}>Partial analysis</span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>Processing…</span>
          )}
          {doc.human_reviewed ? (
            <span className="text-xs px-2.5 py-1 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>Human Reviewed</span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>Pending Review</span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{doc.file_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRetryAI} disabled={retrying} className="dark-btn-outline px-3">
            {retrying ? 'Re-processing…' : 'Retry AI'}
          </button>
          <button onClick={handleSave} disabled={saving} className="dark-btn-primary px-4">
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {retryError && <p className="text-sm mx-5 mt-3 px-4 py-2.5 rounded-lg" style={{ background: 'var(--risk-dim)', color: 'var(--risk)' }}>{retryError}</p>}
      {saveError  && <p className="text-sm mx-5 mt-3 px-4 py-2.5 rounded-lg" style={{ background: 'var(--risk-dim)', color: 'var(--risk)' }}>{saveError}</p>}

      {/* Tab bar */}
      <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid rgba(180,190,220,0.15)' }}>
        <div className="tab-pill-track">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab-pill-btn${activeTab === t.id ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — chat gets no outer padding so it can full-bleed */}
      <div className={activeTab === 'chat' ? 'fade-in' : 'p-6 fade-in'} key={activeTab}>

        {/* ── PARCA Scores ───────────────────────── */}
        {activeTab === 'parca' && (
          <CRAAPEditor
            scores={craap}
            weights={(doc as unknown as { project_craap_weights: Record<string, number> }).project_craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }}
            aiScores={(doc as unknown as { craap_ai_scores: Record<string, number> }).craap_ai_scores}
            onChange={setCraap}
          />
        )}

        {/* ── AI Assessment ──────────────────────── */}
        {activeTab === 'assessment' && (
          <div className="space-y-6">
            {/* Document metadata */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Document Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Document Date</label>
                  <input type="date" value={form.document_date} onChange={e => setForm({ ...form, document_date: e.target.value })}
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as DocumentCategory })}
                    className="dark-select w-full px-3 py-2 rounded-lg text-sm">
                    {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Author</label>
                  <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Source Organization</label>
                  <input value={form.source_organization} onChange={e => setForm({ ...form, source_organization: e.target.value })}
                    className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
                </div>
              </div>
            </div>

            {/* Authority Tier */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Authority Tier</label>
              <div className="flex gap-2 flex-wrap">
                {([1, 2, 3, 4, 5] as AuthorityTier[]).map(t => {
                  const s = TIER_STYLES[t]
                  const isActive = form.authority_tier === t
                  return (
                    <button key={t} onClick={() => setForm({ ...form, authority_tier: t })}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-all"
                      style={isActive
                        ? { background: s.bg, color: s.color, borderColor: s.color + '44' }
                        : { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' }
                      }>
                      {t} — {AUTHORITY_TIER_LABELS[t]}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{AUTHORITY_TIER_DESCRIPTIONS[tier]}</p>
            </div>

            {/* Salience */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Salience: <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{form.relevance_weight}/10</span>
              </label>
              <input type="range" min={1} max={10} value={form.relevance_weight}
                onChange={e => setForm({ ...form, relevance_weight: Number(e.target.value) })}
                className="w-full" style={{ accentColor: 'var(--accent)' }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <span>1 — Peripheral</span><span>10 — Critical</span>
              </div>
            </div>

            {/* Tone / Sentiment */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Tone</label>
              <div className="flex gap-2 flex-wrap">
                {SENTIMENT_OPTIONS.map(s => {
                  const st = SENTIMENT_STYLES[s]
                  const isActive = form.sentiment === s
                  return (
                    <button key={s} onClick={() => setForm({ ...form, sentiment: s })}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold capitalize border transition-all"
                      style={isActive
                        ? { background: st.bg, color: st.color, borderColor: st.border }
                        : { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' }
                      }>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Briefing Document */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Briefing Document</label>
              <BriefingEditor
                content={form.briefing}
                onChange={html => setForm(f => ({ ...f, briefing: html }))}
              />
            </div>

            {/* Key Extracts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key Extracts</label>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, key_extracts: [...f.key_extracts, { quote: '', significance: '' }] }))}
                  className="text-xs px-3 py-1 rounded-md border transition-all"
                  style={{ color: 'var(--accent)', borderColor: 'rgba(79,124,255,0.35)', background: 'var(--accent-dim)' }}>
                  + Add Extract
                </button>
              </div>
              <div className="space-y-3">
                {form.key_extracts.length === 0 && (
                  <p className="text-xs py-3 text-center rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    No extracts yet — run AI processing or add one manually.
                  </p>
                )}
                {form.key_extracts.map((extract, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)' }}>
                    <div className="flex items-start gap-2 mb-2">
                      <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: 10, color: 'var(--accent)', fontWeight: 700, minWidth: 20, paddingTop: 3 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <textarea
                        value={extract.quote}
                        onChange={e => setForm(f => ({ ...f, key_extracts: f.key_extracts.map((ex, j) => j === i ? { ...ex, quote: e.target.value } : ex) }))}
                        rows={2}
                        placeholder="Verbatim quote from the document…"
                        className="dark-textarea w-full text-sm"
                        style={{ background: 'transparent', border: 'none', outline: 'none', lineHeight: 1.7, fontFamily: 'var(--font-space-mono)', fontSize: 12, resize: 'vertical' }}
                      />
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, key_extracts: f.key_extracts.filter((_, j) => j !== i) }))}
                        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, paddingTop: 2 }}>
                        ×
                      </button>
                    </div>
                    <input
                      value={extract.significance}
                      onChange={e => setForm(f => ({ ...f, key_extracts: f.key_extracts.map((ex, j) => j === i ? { ...ex, significance: e.target.value } : ex) }))}
                      placeholder="Why this matters for the engagement…"
                      className="dark-input w-full px-3 py-1.5 rounded-lg text-xs"
                      style={{ marginLeft: 22 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Topics + Flags */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Topics <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
                <input value={form.topics} onChange={e => setForm({ ...form, topics: e.target.value })}
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Flags <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
                <input value={form.flags} onChange={e => setForm({ ...form, flags: e.target.value })}
                  placeholder="e.g. high-priority, outdated"
                  className="dark-input w-full px-3 py-2 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* ── Entities ───────────────────────────── */}
        {activeTab === 'entities' && (
          <div className="space-y-6">
            {doc.named_entities && (() => {
              const ENTITY_SECTIONS = [
                { key: 'orgs',       label: 'Organizations', color: '#4f7cff' },
                { key: 'people',     label: 'People',        color: '#9b7dff' },
                { key: 'properties', label: 'Locations',     color: '#2dd88a' },
                { key: 'funders',    label: 'Funders',       color: '#f5a623' },
              ]
              return ENTITY_SECTIONS.map(({ key, label, color }) => {
                const values = (doc.named_entities as unknown as Record<string, string[]>)?.[key]
                if (!Array.isArray(values) || values.length === 0) return null
                return (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {values.map((v: string) => (
                        <div key={v} className="entity-chip">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}

            {doc.key_numbers && (() => {
              const numSections = [
                { key: 'amounts', label: 'Amounts', color: '#2dd88a' },
                { key: 'dates',   label: 'Dates & Timelines', color: '#f5a623' },
                { key: 'units',   label: 'Units', color: '#9b7dff' },
              ]
              return numSections.map(({ key, label, color }) => {
                const values = (doc.key_numbers as unknown as Record<string, string[]>)?.[key]
                if (!Array.isArray(values) || values.length === 0) return null
                return (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {values.map((v: string) => (
                        <div key={v} className="entity-chip">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}

            {!doc.named_entities && !doc.key_numbers && (
              <div className="py-8 text-center rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No entities extracted yet.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Run AI processing to extract people, organizations, and key numbers.</p>
              </div>
            )}
            {doc.key_numbers && doc.named_entities && (
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            )}
          </div>
        )}

        {/* ── Chat ───────────────────────────────── */}
        {activeTab === 'chat' && documentId && projectId && (
          <div>
            <div className="p-6" style={{ borderBottom: '1px solid var(--border)' }}>
              <DocumentChat documentId={documentId} projectId={projectId} />
            </div>
            <div className="p-6">
              <DocumentComments documentId={documentId} projectId={projectId} currentUserEmail={currentUserEmail ?? ''} />
            </div>
          </div>
        )}
        {activeTab === 'chat' && (!documentId || !projectId) && (
          <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Chat unavailable.</p>
        )}

      </div>
    </div>
  )
}
