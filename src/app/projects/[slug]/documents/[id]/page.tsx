import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentEditor from '@/components/DocumentEditor'

export default async function DocumentPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null
  const isSuperAdmin = role === 'super_admin'

  const { data: document } = await supabase.from('documents').select('*').eq('id', id).single()
  if (!document) notFound()

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (!isSuperAdmin) {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', user.id).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>Projects</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <Link href={`/projects/${slug}`} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>{project.name}</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span className="text-sm font-medium truncate max-w-xs" style={{ color: 'var(--text-primary)' }}>{document.title ?? document.file_name}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <DocumentEditor document={document} projectSlug={slug} role={role} />
      </main>
    </div>
  )
}
