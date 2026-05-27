import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ManuscriptRenderer from '@/components/ManuscriptRenderer'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects')
    .select('client_name, name, manuscript, manuscript_generated_at')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  if (!project?.manuscript) notFound()

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Reframe Concepts</span>
          {project.manuscript_generated_at && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Generated {new Date(project.manuscript_generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="dark-card rounded-xl p-10">
          <ManuscriptRenderer text={project.manuscript} />
        </div>
      </main>
    </div>
  )
}
