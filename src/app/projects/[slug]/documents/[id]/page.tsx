import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentEditor from '@/components/DocumentEditor'
import DocumentComments from '@/components/DocumentComments'

export default async function DocumentPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null
  const isSuperAdmin = role === 'super_admin'
  const isClient = role === 'client'

  const { data: document } = await supabase.from('documents').select('*').eq('id', id).single()
  if (!document) notFound()

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  if (!isSuperAdmin) {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', user.id).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  // --- CLIENT VIEW ---
  if (isClient) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>Projects</Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <Link href={`/projects/${slug}`} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>{project.name}</Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="text-sm font-medium truncate max-w-xs" style={{ color: 'var(--text-primary)' }}>{document.title ?? document.file_name}</span>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          {/* Document summary card — clients see name, date, CRAAP total only */}
          <div className="dark-card rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {document.title ?? document.file_name}
            </h2>
            <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              {document.document_date && (
                <span>{new Date(document.document_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              )}
              {(document as any).craap_total != null && (
                <span>
                  CRAAP Score: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{(document as any).craap_total}</span>
                  <span className="font-normal">/50</span>
                </span>
              )}
              {!document.ai_processed && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>Processing</span>
              )}
            </div>
          </div>

          {/* Comments */}
          <DocumentComments documentId={id} projectId={project.id} currentUserEmail={user.email ?? ''} />
        </main>
      </div>
    )
  }

  // --- STAFF VIEW ---
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
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <DocumentEditor document={document} projectSlug={slug} role={role} />
        <DocumentComments documentId={id} projectId={project.id} currentUserEmail={user.email ?? ''} />
      </main>
    </div>
  )
}
