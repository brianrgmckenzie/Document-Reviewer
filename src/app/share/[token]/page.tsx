import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import ShareClient from '@/components/ShareClient'

async function getProject(token: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projects')
    .select('client_name, name, manuscript, manuscript_generated_at')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()
  return data
}

async function getAudioUrl(token: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projects')
    .select('audio_url')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()
  return (data as { audio_url?: string | null } | null)?.audio_url ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const project = await getProject(token)
  if (!project) return { title: 'Intake Manuscript — Reframe Concepts' }

  const title = `Intake Manuscript: ${project.client_name}`
  const description = `Document review and intake analysis prepared by Reframe Concepts for ${project.client_name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'Reframe Concepts',
    },
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [project, audioUrl] = await Promise.all([
    getProject(token),
    getAudioUrl(token).catch(() => null),
  ])

  if (!project?.manuscript) notFound()

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Reframe Concepts</span>
            <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>· Intake Manuscript: {project.client_name}</span>
          </div>
          {project.manuscript_generated_at && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Generated {new Date(project.manuscript_generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <ShareClient manuscript={project.manuscript} audioUrl={audioUrl} />
      </main>
    </div>
  )
}
