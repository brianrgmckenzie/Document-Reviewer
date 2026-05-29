import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import CompanyDetailClient from '@/components/CompanyDetailClient'

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  intake:       { label: 'Intake',        color: 'var(--warning)' },
  under_review: { label: 'Under Review',  color: 'var(--accent)' },
  complete:     { label: 'Complete',      color: 'var(--success)' },
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'super_admin') redirect('/dashboard')

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, created_at')
    .eq('id', id)
    .single()

  if (!company) redirect('/admin/companies')

  const { data: memberRows } = await admin
    .from('company_members')
    .select('user_id, role, created_at')
    .eq('company_id', id)

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, slug, status, created_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  const userIds = (memberRows ?? []).map((m: any) => m.user_id)
  let members: any[] = []
  if (userIds.length > 0) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]))
    const emailMap = Object.fromEntries((authUsers?.users ?? []).map((u: any) => [u.id, u.email]))
    members = (memberRows ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      email: emailMap[m.user_id] ?? null,
      first_name: profileMap[m.user_id]?.first_name ?? null,
      last_name: profileMap[m.user_id]?.last_name ?? null,
    }))
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        isSuperAdmin={true}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Companies', href: '/admin/companies' },
          { label: company.name },
        ]}
      />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <CompanyDetailClient
          company={company}
          members={members}
          projects={projects ?? []}
          statusStyles={STATUS_STYLES}
        />
      </main>
    </div>
  )
}
