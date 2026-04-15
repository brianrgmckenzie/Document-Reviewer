import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewProjectButton from '@/components/NewProjectButton'
import type { Project } from '@/lib/types'

export default async function DashboardPage() {
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

  let projects: Project[] = []

  if (isSuperAdmin) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    projects = data ?? []
  } else {
    const { data: memberships } = await admin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const projectIds = memberships?.map((m: { project_id: string }) => m.project_id) ?? []

    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: false })
      projects = data ?? []
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--blue)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.6"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.6"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.3"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reframe Concepts</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Document Review</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {isSuperAdmin && (
              <Link href="/admin/users" className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
                Users
              </Link>
            )}
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
            <Link href="/api/auth/signout" className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {projects.length} active client engagement{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isSuperAdmin && <NewProjectButton />}
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => (
              <Link key={project.id} href={`/projects/${project.slug}`} className="project-card block rounded-xl p-6 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--blue)' }}>
                    {project.project_type ?? 'Client'}
                  </span>
                  {project.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold mb-1 text-base" style={{ color: 'var(--text-primary)' }}>{project.name}</h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                {project.description && (
                  <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(project.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {isSuperAdmin ? (
              <>
                <p className="mb-5" style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
                <NewProjectButton />
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No projects assigned to your account yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
