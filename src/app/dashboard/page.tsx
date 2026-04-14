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
    // project_admin: only see assigned projects
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Reframe Concepts</h1>
            <p className="text-xs text-gray-500">Document Review Platform</p>
          </div>
          <div className="flex items-center gap-4">
            {isSuperAdmin && (
              <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-900">
                Users
              </Link>
            )}
            <span className="text-sm text-gray-500">{user.email}</span>
            <Link href="/api/auth/signout" className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Projects</h2>
            <p className="text-sm text-gray-500 mt-1">
              {projects.length} active client project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isSuperAdmin && <NewProjectButton />}
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {project.project_type ?? 'Client'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-500">{project.client_name}</p>
                {project.description && (
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{project.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-4">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            {isSuperAdmin ? (
              <>
                <p className="text-gray-500 mb-4">No projects yet.</p>
                <NewProjectButton />
              </>
            ) : (
              <p className="text-gray-400">No projects assigned to your account yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
