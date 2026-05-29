import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import MembersClient from '@/components/MembersClient'

export default async function AdminMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()

  const role = roleData?.role
  if (role !== 'company_admin' && role !== 'super_admin') redirect('/dashboard')

  // Get companies this user admins
  const { data: companyMemberships } = await admin
    .from('company_members')
    .select('company_id, companies(id, name)')
    .eq('user_id', user.id)
    .eq('role', 'admin')

  const companies = (companyMemberships ?? []).map((m: any) => m.companies).filter(Boolean)
  const companyIds = companies.map((c: any) => c.id)

  // Get projects within those companies
  const { data: projects } = companyIds.length > 0
    ? await admin
        .from('projects')
        .select('id, name, slug, company_id')
        .in('company_id', companyIds)
        .order('name')
    : { data: [] }

  // Get project members for those projects
  const projectIds = (projects ?? []).map((p: any) => p.id)
  const { data: memberships } = projectIds.length > 0
    ? await admin
        .from('project_members')
        .select('user_id, project_id')
        .in('project_id', projectIds)
    : { data: [] }

  const memberUserIds = [...new Set((memberships ?? []).map((m: any) => m.user_id))]
  let memberUsers: any[] = []
  if (memberUserIds.length > 0) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, first_name, last_name, organization')
      .in('user_id', memberUserIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]))
    const emailMap = Object.fromEntries((authUsers?.users ?? []).map((u: any) => [u.id, u.email]))
    const assignedProjects: Record<string, { id: string; name: string; slug: string }[]> = {}
    for (const m of memberships ?? []) {
      if (!assignedProjects[m.user_id]) assignedProjects[m.user_id] = []
      const p = (projects ?? []).find((pr: any) => pr.id === m.project_id)
      if (p) assignedProjects[m.user_id].push({ id: p.id, name: p.name, slug: p.slug })
    }
    memberUsers = memberUserIds.map(uid => ({
      id: uid,
      email: emailMap[uid] ?? null,
      first_name: profileMap[uid]?.first_name ?? null,
      last_name: profileMap[uid]?.last_name ?? null,
      organization: profileMap[uid]?.organization ?? null,
      projects: assignedProjects[uid] ?? [],
    }))
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        isCompanyAdmin={role === 'company_admin'}
        isSuperAdmin={role === 'super_admin'}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Members' }]}
      />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <MembersClient
          projects={projects ?? []}
          members={memberUsers}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
