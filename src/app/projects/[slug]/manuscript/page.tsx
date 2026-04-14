import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ManuscriptClient from '@/components/ManuscriptClient'

export default async function ManuscriptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!project) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('id')
    .eq('project_id', project.id)
    .eq('ai_processed', true)

  const processedCount = documents?.length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">Projects</Link>
          <span className="text-gray-300">/</span>
          <Link href={`/projects/${slug}`} className="text-sm text-gray-400 hover:text-gray-700">{project.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">Manuscript</span>
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
