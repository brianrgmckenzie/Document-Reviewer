import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ProjectImageUpload from '@/components/ProjectImageUpload'
import ProjectStatusControl from '@/components/ProjectStatusControl'
import ProjectNameEditor from '@/components/ProjectNameEditor'
import DeleteProjectButton from '@/components/DeleteProjectButton'
import NewSubProjectButton from '@/components/NewSubProjectButton'
import DocumentCard from '@/components/DocumentCard'
import AppNav from '@/components/AppNav'
import type { Document } from '@/lib/types'
import { getEffectiveSession } from '@/lib/getEffectiveSession'

const SUB_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(45,216,138,0.12)',  color: 'var(--success)',  label: 'Active' },
  complete: { bg: 'var(--accent-dim)',       color: 'var(--accent)',   label: 'Complete' },
  archived: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8',         label: 'Archived' },
}

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

function parcaColor(total: number) {
  const pct = total / 50
  if (pct >= 0.7) return 'var(--success)'
  if (pct >= 0.45) return 'var(--warning)'
  return 'var(--risk)'
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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

  // Fetch sub-projects with document counts (may be empty if migration not yet run)
  const { data: subProjectsRaw } = await admin
    .from('sub_projects')
    .select('*, documents(count)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })

  const subProjects = (subProjectsRaw ?? []).map((sp: any) => ({
    ...sp,
    doc_count: sp.documents?.[0]?.count ?? 0,
  }))

  // Always fetch all documents — fallback for pre-migration projects
  const { data: allDocuments } = await admin
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('authority_tier', { ascending: true })
    .order('human_reviewed', { ascending: true })
    .order('file_name', { ascending: true })

  // Documents without a sub_project_id are orphaned (pre-migration or unassigned)
  const orphanedDocs = (allDocuments ?? []).filter((d: any) => !d.sub_project_id)

  const totalDocs = subProjects.reduce((s: number, sp: any) => s + sp.doc_count, 0) + orphanedDocs.length

  const uploaderIds = [...new Set(orphanedDocs.map((d: any) => d.uploaded_by).filter(Boolean))] as string[]
  const uploaderEmails: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    authUsers.forEach((u: any) => { uploaderEmails[u.id] = u.email ?? u.id })
  }

  // ── CLIENT VIEW ──────────────────────────────────────────────────────────
  if (isClient) {
    const isComplete = project.status === 'complete'
    const orphanedByTier: Record<number, Document[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    orphanedDocs.forEach((doc: any) => {
      const tier = doc.authority_tier ?? 5
      if (orphanedByTier[tier]) orphanedByTier[tier].push(doc)
      else orphanedByTier[5].push(doc)
    })

    return (
      <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
        <AppNav
          email={user.email}
          breadcrumbs={[
            { label: 'Projects', href: '/dashboard' },
            { label: project.name },
          ]}
        />

        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="dark-card p-6 mb-6" style={{ borderRadius: 16 }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                {project.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.image_url} alt="" className="rounded-xl object-cover shrink-0" style={{ width: 52, height: 52, border: '1px solid var(--border)' }} />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {project.project_type ?? 'Client'}
                    </span>
                    <ProjectStatusControl projectId={project.id} currentStatus={project.status ?? 'intake'} isSuperAdmin={false} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>{project.name}</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                  {project.description && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isComplete && project.manuscript && (
                  <Link href={`/projects/${slug}/manuscript`} className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    View Manuscript
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Sub-project list */}
          {subProjects.length > 0 && (
            <div className="space-y-3 mb-6">
              {subProjects.map((sp: any) => {
                const style = SUB_STATUS_STYLES[sp.status] ?? SUB_STATUS_STYLES.active
                return (
                  <Link key={sp.id} href={`/projects/${slug}/${sp.slug}`} className="dark-card block p-5 transition-all hover:border-[var(--accent)]" style={{ borderRadius: 12, textDecoration: 'none' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{sp.name}</h3>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                        </div>
                        {sp.description && <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{sp.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1 }}>{sp.doc_count}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sp.doc_count === 1 ? 'document' : 'documents'}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Orphaned documents (pre-migration or unassigned) */}
          {orphanedDocs.length > 0 && (
            <div>
              {subProjects.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Unassigned Documents</p>
              )}
              <div className="dark-card overflow-hidden" style={{ borderRadius: 14 }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-space-grotesk)' }}>
                    Documents <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({orphanedDocs.length})</span>
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Document', 'Date', 'PARCA Score'].map(h => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orphanedDocs.map((doc: any) => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-5 py-3">
                          <Link href={`/projects/${slug}/documents/${doc.id}`} className="font-medium hover:underline" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-space-grotesk)' }}>
                            {doc.title ?? doc.file_name}
                          </Link>
                          {doc.title && doc.title !== doc.file_name && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{doc.file_name}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {doc.document_date
                            ? new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
                            : new Date(doc.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-3">
                          {(doc as any).craap_total != null ? (
                            <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, color: parcaColor((doc as any).craap_total) }}>
                              {(doc as any).craap_total}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>/50</span>
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalDocs === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── STAFF VIEW ───────────────────────────────────────────────────────────
  const orphanedByTier: Record<number, Document[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  orphanedDocs.forEach((doc: any) => {
    const tier = doc.authority_tier ?? 5
    if (orphanedByTier[tier]) orphanedByTier[tier].push(doc)
    else orphanedByTier[5].push(doc)
  })

  return (
    <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        breadcrumbs={[
          { label: 'Projects', href: '/dashboard' },
          { label: project.name },
        ]}
      />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Project header card */}
        <div className="dark-card p-6 mb-6" style={{ borderRadius: 16 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div style={{ flexShrink: 0 }}>
                <ProjectImageUpload projectId={project.id} currentImageUrl={project.image_url} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{project.project_type}</span>
                  <ProjectStatusControl projectId={project.id} currentStatus={project.status ?? 'intake'} isSuperAdmin={isSuperAdmin} />
                </div>
                <ProjectNameEditor projectId={project.id} name={project.name} clientName={project.client_name} projectType={project.project_type ?? null} isSuperAdmin={isSuperAdmin} />
                {project.description && <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-start">
              {isSuperAdmin && (
                <Link href={`/projects/${slug}/manuscript`} className="dark-btn-outline px-4 py-2 text-sm font-medium rounded-lg transition-all" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Manuscript</Link>
              )}
              {isStaff && (
                <>
                  <Link href={`/projects/${slug}/reports`} className="dark-btn-outline px-4 py-2 text-sm font-medium rounded-lg transition-all" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Reports</Link>
                  <NewSubProjectButton projectId={project.id} projectSlug={slug} />
                </>
              )}
              {isSuperAdmin && (
                <DeleteProjectButton projectId={project.id} projectName={project.name} />
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-8 mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}>{subProjects.length}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Sub-projects</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}>{totalDocs}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Documents</p>
            </div>
          </div>
        </div>

        {/* Sub-project cards */}
        {subProjects.length > 0 && (
          <div className="space-y-3 mb-8">
            {subProjects.map((sp: any) => {
              const style = SUB_STATUS_STYLES[sp.status] ?? SUB_STATUS_STYLES.active
              return (
                <Link key={sp.id} href={`/projects/${slug}/${sp.slug}`} className="dark-card block p-5 transition-all hover:border-[var(--accent)]" style={{ borderRadius: 12, textDecoration: 'none' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{sp.name}</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                      </div>
                      {sp.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{sp.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}>{sp.doc_count}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sp.doc_count === 1 ? 'document' : 'documents'}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Orphaned documents (pre-migration or unassigned) shown inline */}
        {orphanedDocs.length > 0 && (
          <div>
            {subProjects.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Unassigned Documents</p>
            )}
            {[1, 2, 3, 4, 5].map(tier => {
              const tierDocs = orphanedByTier[tier]
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
          </div>
        )}

        {totalDocs === 0 && subProjects.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>No sub-projects yet.</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create a sub-project to start uploading documents.</p>
          </div>
        )}
      </main>
    </div>
  )
}
