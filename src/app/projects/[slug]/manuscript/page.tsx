import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ManuscriptClient from '@/components/ManuscriptClient'

export default async function ManuscriptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  const { data: documents } = await supabase.from('documents').select('id').eq('project_id', project.id).eq('ai_processed', true)
  const processedCount = documents?.length ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>Projects</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <Link href={`/projects/${slug}`} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>{project.name}</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Manuscript</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <ManuscriptClient
          project={project}
          processedCount={processedCount}
          initialManuscript={project.manuscript ?? null}
          manuscriptGeneratedAt={project.manuscript_generated_at ?? null}
        />
      </main>
    </div>
  )
}
