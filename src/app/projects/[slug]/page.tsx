import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentUpload from '@/components/DocumentUpload'
import DocumentCard from '@/components/DocumentCard'
import CRAAPWeights from '@/components/CRAAPWeights'
import SearchModal from '@/components/SearchModal'
import ProjectImageUpload from '@/components/ProjectImageUpload'
import type { Document } from '@/lib/types'

const TIER_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  3: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  4: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  5: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null
  const isSuperAdmin = role === 'super_admin'

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (!isSuperAdmin) {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', user.id).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  const { data: documents } = await supabase
    .from('documents').select('*').eq('project_id', project.id)
    .order('authority_tier', { ascending: true }).order('document_date', { ascending: false })

  const byTier: Record<number, Document[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  documents?.forEach((doc: Document) => {
    const tier = doc.authority_tier ?? 5
    if (byTier[tier]) byTier[tier].push(doc)
    else byTier[5].push(doc)
  })

  const flags = documents?.flatMap((d: Document) => d.flags ?? []) ?? []
  const hasRisks = flags.includes('high-priority') || documents?.some((d: Document) => d.sentiment === 'risk')
  const unreviewed = documents?.filter((d: Document) => d.ai_processed && !d.human_reviewed).length ?? 0

  const tierLabels: Record<number, string> = {
    1: 'Tier 1 — Constitutional', 2: 'Tier 2 — Regulatory',
    3: 'Tier 3 — Strategic', 4: 'Tier 4 — Operational', 5: 'Tier 5 — Historical',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>Projects</Link>
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
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--blue)' }}>{project.project_type}</span>
                <h2 className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{project.name}</h2>
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
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{tierLabels[tier]}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{tierDocs.length} document{tierDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {tierDocs.map((doc: Document) => <DocumentCard key={doc.id} document={doc} projectSlug={slug} />)}
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
