import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentUpload from '@/components/DocumentUpload'
import DocumentCard from '@/components/DocumentCard'
import CRAAPWeights from '@/components/CRAAPWeights'
import SearchModal from '@/components/SearchModal'
import type { Document } from '@/lib/types'

const TIER_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-yellow-100 text-yellow-800',
  5: 'bg-gray-100 text-gray-600',
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = roleData?.role ?? null
  const isSuperAdmin = role === 'super_admin'

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!project) notFound()

  // project_admin must be a member of this project
  if (!isSuperAdmin) {
    const { data: membership } = await admin
      .from('project_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', project.id)
      .single()

    if (!membership) notFound()
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('authority_tier', { ascending: true })
    .order('document_date', { ascending: false })

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">
              Projects
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">{project.name}</span>
          </div>
          <span className="text-sm text-gray-500">{user.email}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Project Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {project.project_type}
              </span>
              <h2 className="text-2xl font-semibold text-gray-900 mt-1">{project.name}</h2>
              <p className="text-gray-500 mt-1">{project.client_name}</p>
              {project.description && (
                <p className="text-sm text-gray-400 mt-2">{project.description}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {isSuperAdmin && (
                <>
                  <SearchModal
                    projectId={project.id}
                    projectSlug={slug}
                    suppressedWords={project.search_suppressed_words ?? []}
                  />
                  <CRAAPWeights
                    projectId={project.id}
                    initialWeights={project.craap_weights ?? { currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1 }}
                  />
                  <Link
                    href={`/projects/${slug}/manuscript`}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Manuscript
                  </Link>
                </>
              )}
              <DocumentUpload projectId={project.id} />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex gap-6 mt-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-2xl font-semibold text-gray-900">{documents?.length ?? 0}</p>
              <p className="text-xs text-gray-500">Documents</p>
            </div>
            {unreviewed > 0 && (
              <div>
                <p className="text-2xl font-semibold text-amber-600">{unreviewed}</p>
                <p className="text-xs text-gray-500">Awaiting Review</p>
              </div>
            )}
            {hasRisks && (
              <div>
                <p className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">
                  Risk flags detected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Documents by Tier */}
        {[1, 2, 3, 4, 5].map(tier => {
          const tierDocs = byTier[tier]
          if (tierDocs.length === 0) return null

          const tierLabels: Record<number, string> = {
            1: 'Tier 1 — Constitutional',
            2: 'Tier 2 — Regulatory',
            3: 'Tier 3 — Strategic',
            4: 'Tier 4 — Operational',
            5: 'Tier 5 — Historical',
          }

          return (
            <div key={tier} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_COLORS[tier]}`}>
                  {tierLabels[tier]}
                </span>
                <span className="text-sm text-gray-400">{tierDocs.length} document{tierDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {tierDocs.map((doc: Document) => (
                  <DocumentCard key={doc.id} document={doc} projectSlug={slug} />
                ))}
              </div>
            </div>
          )
        })}

        {(!documents || documents.length === 0) && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 mb-2">No documents uploaded yet.</p>
            <p className="text-sm text-gray-400">Upload documents to begin the AI assessment.</p>
          </div>
        )}
      </main>
    </div>
  )
}
