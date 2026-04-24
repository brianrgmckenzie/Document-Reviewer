import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentEditor from '@/components/DocumentEditor'
import DocumentComments from '@/components/DocumentComments'
import DocumentChat from '@/components/DocumentChat'
import AppNav from '@/components/AppNav'
import { getEffectiveSession } from '@/lib/getEffectiveSession'

const TIER_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  2: { bg: 'var(--accent-dim)',     color: 'var(--accent)' },
  3: { bg: 'var(--purple-dim)',     color: 'var(--purple)' },
  4: { bg: 'var(--warning-dim)',    color: 'var(--warning)' },
  5: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Constitutional', 2: 'Tier 2 — Regulatory',
  3: 'Tier 3 — Strategic',      4: 'Tier 4 — Operational', 5: 'Tier 5 — Historical',
}

function parcaColor(total: number) {
  const pct = total / 50
  if (pct >= 0.7) return 'var(--success)'
  if (pct >= 0.45) return 'var(--warning)'
  return 'var(--risk)'
}

const SENTIMENT_STYLES: Record<string, { bg: string; color: string }> = {
  risk:       { bg: 'var(--risk-dim)',    color: 'var(--risk)' },
  commitment: { bg: 'var(--accent-dim)',  color: 'var(--accent)' },
  aspiration: { bg: 'var(--success-dim)', color: 'var(--success)' },
  neutral:    { bg: 'var(--surface-3)',   color: 'var(--text-secondary)' },
}

export default async function DocumentPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const session = await getEffectiveSession(user.id, user.email ?? '', roleData?.role ?? null)
  const { role, userId: effectiveUserId, isImpersonating } = session
  const isSuperAdmin = role === 'super_admin'
  const isClient = role === 'client'

  const { data: document } = await supabase.from('documents').select('*').eq('id', id).single()
  if (!document) notFound()

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (isSuperAdmin && !isImpersonating) {
    // always has access
  } else {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', effectiveUserId).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  const tier = document.authority_tier as number | null
  const tierStyle = tier ? TIER_STYLES[tier] : null
  const tierLabel = tier ? TIER_LABELS[tier] : null
  const craapTotal = (document as any).craap_total
  const hasRisk = (document.flags ?? []).includes('high-priority') || document.sentiment === 'risk'
  const sentStyle = document.sentiment ? SENTIMENT_STYLES[document.sentiment] : null

  let uploaderEmail: string | null = null
  if (document.uploaded_by) {
    const { data: { user: uploader } } = await admin.auth.admin.getUserById(document.uploaded_by)
    uploaderEmail = uploader?.email ?? null
  }

  const metaParts = [
    document.document_date ? new Date(document.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
    document.source_organization,
    document.category,
    uploaderEmail ? `Uploaded by ${uploaderEmail}` : null,
  ].filter(Boolean)

  // ── CLIENT VIEW ──────────────────────────────────────────────────────────
  if (isClient) {
    return (
      <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
        <AppNav
          email={user.email}
          breadcrumbs={[
            { label: 'Projects', href: '/dashboard' },
            { label: project.name, href: `/projects/${slug}` },
            { label: document.title ?? document.file_name },
          ]}
        />
        <main className="max-w-4xl mx-auto px-6 py-10 space-y-5">
          {/* Document header */}
          <div className="dark-card p-6" style={{ borderRadius: 14 }}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {tierStyle && tierLabel && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: tierStyle.bg, color: tierStyle.color, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tierLabel}</span>
              )}
              {hasRisk && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--risk-dim)', color: 'var(--risk)', fontSize: 10 }}>Risk</span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 6 }}>
              {document.title ?? document.file_name}
            </h2>
            {metaParts.length > 0 && (
              <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{metaParts.join(' · ')}</p>
            )}
            {document.summary && (
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>{document.summary}</p>
            )}
            {document.topics && document.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {document.topics.slice(0, 6).map((t: string) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 3, fontSize: 10, fontWeight: 500, background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t}</span>
                ))}
              </div>
            )}
            {!document.ai_processed && (
              <div className="mt-3">
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>Processing</span>
              </div>
            )}
            {craapTotal != null && (
              <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>PARCA</p>
                  <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 22, color: parcaColor(craapTotal) }}>
                    {craapTotal}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/50</span>
                  </span>
                </div>
                {document.relevance_weight != null && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Salience</p>
                    <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>
                      {document.relevance_weight}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>
                    </span>
                  </div>
                )}
                {sentStyle && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded capitalize" style={{ background: sentStyle.bg, color: sentStyle.color }}>{document.sentiment}</span>
                )}
              </div>
            )}
          </div>

          <DocumentChat documentId={id} projectId={project.id} />
          <DocumentComments documentId={id} projectId={project.id} currentUserEmail={user.email ?? ''} />
        </main>
      </div>
    )
  }

  // ── STAFF VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        breadcrumbs={[
          { label: 'Projects', href: '/dashboard' },
          { label: project.name, href: `/projects/${slug}` },
          { label: document.title ?? document.file_name },
        ]}
      />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-5">
        {/* Document header card */}
        <div className="dark-card p-6" style={{ borderRadius: 14 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {tierStyle && tierLabel && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: tierStyle.bg, color: tierStyle.color, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tierLabel}</span>
            )}
            {hasRisk && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--risk-dim)', color: 'var(--risk)', fontSize: 10 }}>
                <span className="risk-dot" style={{ width: 5, height: 5 }} />Risk
              </span>
            )}
          </div>
          <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 6 }}>
            {document.title ?? document.file_name}
          </h2>
          {metaParts.length > 0 && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{metaParts.join(' · ')}</p>
          )}
          {document.summary && (
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>{document.summary}</p>
          )}
          {document.topics && document.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {document.topics.slice(0, 8).map((t: string) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 3, fontSize: 10, fontWeight: 500, background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t}</span>
              ))}
            </div>
          )}

          {/* Score summary row */}
          {(craapTotal != null || document.relevance_weight != null || sentStyle) && (
            <div className="flex items-center gap-5 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              {document.relevance_weight != null && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Salience</p>
                  <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>
                    {document.relevance_weight}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>
                  </span>
                </div>
              )}
              {craapTotal != null && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>PARCA</p>
                  <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 22, color: parcaColor(craapTotal) }}>
                    {craapTotal}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/50</span>
                  </span>
                </div>
              )}
              {sentStyle && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded capitalize" style={{ background: sentStyle.bg, color: sentStyle.color }}>{document.sentiment}</span>
              )}
            </div>
          )}
        </div>

        {/* DocumentEditor with tabs (includes Chat tab) */}
        <DocumentEditor
          document={document}
          projectSlug={slug}
          role={role}
          documentId={id}
          projectId={project.id}
          currentUserEmail={user.email ?? ''}
        />
      </main>
    </div>
  )
}
