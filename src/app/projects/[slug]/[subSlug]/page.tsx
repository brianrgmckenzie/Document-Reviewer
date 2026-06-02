import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentUpload from '@/components/DocumentUpload'
import DocumentCard from '@/components/DocumentCard'
import CRAAPWeights from '@/components/CRAAPWeights'
import SearchModal from '@/components/SearchModal'
import AppNav from '@/components/AppNav'
import type { Document } from '@/lib/types'
import { getEffectiveSession } from '@/lib/getEffectiveSession'

const TIER_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
  2: { bg: 'var(--accent-dim)',      color: 'var(--accent)' },
  3: { bg: 'var(--purple-dim)',      color: 'var(--purple)' },
  4: { bg: 'var(--warning-dim)',     color: 'var(--warning)' },
  5: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Constitutional', 2: 'Tier 2 — Regulatory',
  3: 'Tier 3 — Strategic',      4: 'Tier 4 — Operational', 5: 'Tier 5 — Historical',
}

const SUB_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(45,216,138,0.12)',  color: 'var(--success)',  label: 'Active' },
  complete: { bg: 'var(--accent-dim)',       color: 'var(--accent)',   label: 'Complete' },
  archived: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8',         label: 'Archived' },
}

function parcaColor(total: number) {
  const pct = total / 50
  if (pct >= 0.7) return 'var(--success)'
  if (pct >= 0.45) return 'var(--warning)'
  return 'var(--risk)'
}

export default async function SubProjectPage({ params }: { params: Promise<{ slug: string; subSlug: string }> }) {
  const { slug, subSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const session = await getEffectiveSession(user.id, user.email ?? '', roleData?.role ?? null)
  const { role, userId: effectiveUserId, isImpersonating } = session
  const isSuperAdmin = role === 'super_admin'
  const isClient = role === 'client'
  const isStaff = !isClient

  const { data: project } = await admin.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (isSuperAdmin && !isImpersonating) {
    // super_admin always has access
  } else {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', effectiveUserId).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  const { data: subProject } = await admin
    .from('sub_projects')
    .select('*')
    .eq('project_id', project.id)
    .eq('slug', subSlug)
    .single()
  if (!subProject) notFound()

  const { data: documents } = await admin
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .eq('sub_project_id', subProject.id)
    .order('authority_tier', { ascending: true })
    .order('document_date', { ascending: false })

  const uploaderIds = [...new Set((documents ?? []).map((d: Document) => d.uploaded_by).filter(Boolean))] as string[]
  const uploaderEmails: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    authUsers.forEach((u: any) => { uploaderEmails[u.id] = u.email ?? u.id })
  }

  const statusStyle = SUB_STATUS_STYLES[subProject.status] ?? SUB_STATUS_STYLES.active

  // ── CLIENT VIEW ──────────────────────────────────────────────────────────
  if (isClient) {
    return (
      <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
        <AppNav
          email={user.email}
          breadcrumbs={[
            { label: 'Projects', href: '/dashboard' },
            { label: project.name, href: `/projects/${slug}` },
            { label: subProject.name },
          ]}
        />

        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="dark-card p-6 mb-6" style={{ borderRadius: 16 }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>{subProject.name}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {statusStyle.label}
                  </span>
                </div>
                {subProject.description && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{subProject.description}</p>}
              </div>
              <DocumentUpload projectId={project.id} subProjectId={subProject.id} />
            </div>
          </div>

          <div className="dark-card overflow-hidden" style={{ borderRadius: 14 }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-space-grotesk)' }}>
                Documents <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({documents?.length ?? 0})</span>
              </h3>
            </div>

            {(!documents || documents.length === 0) ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Document', 'Uploaded by', 'Date', 'PARCA Score'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(documents ?? []).map((doc: Document) => (
                    <tr key={doc.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${slug}/documents/${doc.id}`}
                          className="font-medium transition-colors hover:underline"
                          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {doc.title ?? doc.file_name}
                        </Link>
                        {!doc.ai_processed && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>Processing</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {uploaderEmails[doc.uploaded_by] ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {doc.document_date
                          ? new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
                          : new Date(doc.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        {(doc as any).craap_total != null ? (
                          <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, color: parcaColor((doc as any).craap_total) }}>
                            {(doc as any).craap_total}
                            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>/50</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── STAFF VIEW ───────────────────────────────────────────────────────────
  const byTier: Record<number, Document[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  documents?.forEach((doc: Document) => {
    const tier = doc.authority_tier ?? 5
    if (byTier[tier]) byTier[tier].push(doc)
    else byTier[5].push(doc)
  })

  const flags = documents?.flatMap((d: Document) => d.flags ?? []) ?? []
  const hasRisks = flags.includes('high-priority') || documents?.some((d: Document) => d.sentiment === 'risk')
  const unreviewed = documents?.filter((d: Document) => d.ai_processed && !d.human_reviewed).length ?? 0

  const avgParca = (() => {
    const scored = (documents ?? []).filter((d: Document) => (d as any).craap_total != null)
    if (!scored.length) return null
    return Math.round(scored.reduce((s: number, d: Document) => s + (d as any).craap_total, 0) / scored.length)
  })()

  return (
    <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        breadcrumbs={[
          { label: 'Projects', href: '/dashboard' },
          { label: project.name, href: `/projects/${slug}` },
          { label: subProject.name },
        ]}
      />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Sub-project header card */}
        <div className="dark-card p-6 mb-6" style={{ borderRadius: 16 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {project.name}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                  {statusStyle.label}
                </span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>
                {subProject.name}
              </h2>
              {hasRisks && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="risk-dot" style={{ width: 6, height: 6 }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--risk)' }}>Risk flags detected</span>
                </div>
              )}
              {subProject.description && <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{subProject.description}</p>}
            </div>

            <div className="flex gap-2 flex-wrap items-start">
              {isSuperAdmin && (
                <>
                  <SearchModal projectId={project.id} projectSlug={slug} suppressedWords={project.search_suppressed_words ?? []} />
                  <CRAAPWeights projectId={project.id} initialWeights={project.craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }} />
                </>
              )}
              <DocumentUpload projectId={project.id} subProjectId={subProject.id} />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-8 mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}>
                {documents?.length ?? 0}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Documents</p>
            </div>
            {avgParca != null && (
              <div>
                <p style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 24, color: parcaColor(avgParca), lineHeight: 1 }}>
                  {avgParca}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/50</span>
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Avg PARCA</p>
              </div>
            )}
            {unreviewed > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 24, color: 'var(--warning)', lineHeight: 1 }}>{unreviewed}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Awaiting Review</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents by tier */}
        {[1, 2, 3, 4, 5].map(tier => {
          const tierDocs = byTier[tier]
          if (tierDocs.length === 0) return null
          const { bg, color } = TIER_STYLES[tier]
          return (
            <div key={tier} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded" style={{ background: bg, color, letterSpacing: '0.03em' }}>{TIER_LABELS[tier]}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tierDocs.length} document{tierDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                {tierDocs.map((doc: Document, i: number) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    projectSlug={slug}
                    uploaderEmail={uploaderEmails[doc.uploaded_by]}
                    isLast={i === tierDocs.length - 1}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {(!documents || documents.length === 0) && (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>No documents uploaded yet.</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Upload documents to begin the AI assessment.</p>
          </div>
        )}
      </main>
    </div>
  )
}
