import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import ManuscriptClient from '@/components/ManuscriptClient'
import AppNav from '@/components/AppNav'
import { getEffectiveSession } from '@/lib/getEffectiveSession'

export default async function ManuscriptPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const { data: project } = await supabase.from('projects').select('*').eq('slug', slug).single()
  if (!project) notFound()

  // Clients can only view if project is complete
  if (isClient && project.status !== 'complete') notFound()

  if (isSuperAdmin && !isImpersonating) {
    // super_admin always has access
  } else {
    const { data: membership } = await admin.from('project_members').select('id').eq('user_id', effectiveUserId).eq('project_id', project.id).single()
    if (!membership) notFound()
  }

  const { data: documents } = await supabase.from('documents').select('id').eq('project_id', project.id).eq('ai_processed', true)
  const processedCount = documents?.length ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        isSuperAdmin={isSuperAdmin}
        breadcrumbs={[
          { label: 'Projects', href: '/dashboard' },
          { label: project.name, href: `/projects/${slug}` },
          { label: 'Manuscript' },
        ]}
      />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <ManuscriptClient
          project={project}
          processedCount={processedCount}
          initialManuscript={project.manuscript ?? null}
          manuscriptGeneratedAt={project.manuscript_generated_at ?? null}
          readOnly={isClient}
        />
      </main>
    </div>
  )
}
