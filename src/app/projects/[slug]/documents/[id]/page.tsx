import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentEditor from '@/components/DocumentEditor'

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
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

  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (!document) notFound()

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">Projects</Link>
          <span className="text-gray-300">/</span>
          <Link href={`/projects/${slug}`} className="text-sm text-gray-400 hover:text-gray-700">{project.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
            {document.title ?? document.file_name}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <DocumentEditor document={document} projectSlug={slug} role={role} />
      </main>
    </div>
  )
}
