import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentUpload from '@/components/DocumentUpload'
import DocumentCard from '@/components/DocumentCard'
import CRAAPWeights from '@/components/CRAAPWeights'
import SearchModal from '@/components/SearchModal'
import ProjectImageUpload from '@/components/ProjectImageUpload'
import ProjectStatusControl from '@/components/ProjectStatusControl'
import type { Document } from '@/lib/types'
import AppLogo from '@/components/AppLogo'
import { getEffectiveSession } from '@/lib/getEffectiveSession'

const TIER_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  3: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  4: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  5: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Constitutional', 2: 'Tier 2 — Regulatory',
  3: 'Tier 3 — Strategic', 4: 'Tier 4 — Operational', 5: 'Tier 5 — Historical',
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

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (isSuperAdmin && !isImpersonating) {
    // super_admin always has access
  } else {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', effectiveUserId).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  const { data: documents } = await supabase
    .from('documents').select('*').eq('project_id', project.id)
    .order('authority_tier', { ascending: true }).order('document_date', { ascending: false })

  // Fetch uploader emails for all documents
  const uploaderIds = [...new Set((documents ?? []).map((d: Document) => d.uploaded_by).filter(Boolean))] as string[]
  const uploaderEmails: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    authUsers.forEach((u: any) => { uploaderEmails[u.id] = u.email ?? u.id })
  }

  // --- CLIENT VIEW ---
  if (isClient) {
    const isComplete = project.status === 'complete'
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard"><AppLogo height={18} /></Link>
              <span style={{ color: 'var(--border)' }}>/</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</span>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-10">
          {/* Project header */}
          <div className="dark-card rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                {project.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" style={{ border: '1px solid var(--border)' }} />
                )}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</h2>
                    <ProjectStatusControl projectId={project.id} currentStatus={project.status ?? 'intake'} isSuperAdmin={false} />
                  </div>
                  <p style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                  {project.description && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isComplete && project.manuscript && (
                  <Link
                    href={`/projects/${slug}/manuscript`}
                    className="dark-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-all"
                  >
                    View Manuscript
                  </Link>
                )}
                <DocumentUpload projectId={project.id} />
              </div>
            </div>
          </div>

          {/* Document list */}
          <div className="dark-card rounded-xl overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
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
                    {['Document', 'Uploaded by', 'Date', 'CRAAP Score'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(documents ?? []).map((doc: Document) => (
                    <tr key={doc.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${slug}/documents/${doc.id}`}
                          className="font-medium transition-colors hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {doc.title ?? doc.file_name}
                        </Link>
                        {!doc.ai_processed && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>Processing</span>
                        )}
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                        {uploaderEmails[doc.uploaded_by] ?? '—'}
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                        {doc.document_date
                          ? new Date(doc.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
                          : new Date(doc.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        {(doc as any).craap_total != null
                          ? <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{(doc as any).craap_total}<span className="font-normal text-xs ml-0.5" style={{ color: 'var(--text-muted)' }}>/50</span></span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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

  // --- STAFF VIEW (super_admin / project_admin) ---
  const byTier: Record<number, Document[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  documents?.forEach((doc: Document) => {
    const tier = doc.authority_tier ?? 5
    if (byTier[tier]) byTier[tier].push(doc)
    else byTier[5].push(doc)
  })

  const flags = documents?.flatMap((d: Document) => d.flags ?? []) ?? []
  const hasRisks = flags.includes('high-priority') || documents?.some((d: Document) => d.sentiment === 'risk')
  const unreviewed = documents?.filter((d: Document) => d.ai_processed && !d.human_reviewed).length ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard"><AppLogo height={18} /></Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</span>
          </div>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="dark-card rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <ProjectImageUpload projectId={project.id} currentImageUrl={project.image_url ?? null} />
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--blue)' }}>{project.project_type}</span>
                  <ProjectStatusControl projectId={project.id} currentStatus={project.status ?? 'intake'} isSuperAdmin={isSuperAdmin} />
                </div>
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</h2>
                <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                {project.description && <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isSuperAdmin && (
                <>
                  <SearchModal projectId={project.id} projectSlug={slug} suppressedWords={project.search_suppressed_words ?? []} />
                  <CRAAPWeights projectId={project.id} initialWeights={project.craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }} />
                  <Link href={`/projects/${slug}/manuscript`} className="dark-btn-outline px-4 py-2 text-sm font-medium rounded-lg transition-all">Manuscript</Link>
                </>
              )}
              <DocumentUpload projectId={project.id} />
            </div>
          </div>

          <div className="flex gap-6 mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{documents?.length ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Documents</p>
            </div>
            {unreviewed > 0 && (
              <div>
                <p className="text-2xl font-semibold" style={{ color: '#fbbf24' }}>{unreviewed}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Awaiting Review</p>
              </div>
            )}
            {hasRisks && (
              <div className="flex items-center">
                <p className="text-sm font-medium px-3 py-1 rounded-full" style={{ color: '#f87171', background: 'rgba(239,68,68,0.15)' }}>Risk flags detected</p>
              </div>
            )}
          </div>
        </div>

        {[1, 2, 3, 4, 5].map(tier => {
          const tierDocs = byTier[tier]
          if (tierDocs.length === 0) return null
          const { bg, color } = TIER_STYLES[tier]
          return (
            <div key={tier} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{TIER_LABELS[tier]}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{tierDocs.length} document{tierDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {tierDocs.map((doc: Document) => (
                  <DocumentCard key={doc.id} document={doc} projectSlug={slug} uploaderEmail={uploaderEmails[doc.uploaded_by]} />
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
