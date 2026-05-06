import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminUsersClient from '@/components/AdminUsersClient'
import AppNav from '@/components/AppNav'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'super_admin') redirect('/dashboard')

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, slug')
    .order('name')

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        isSuperAdmin={true}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
      />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <AdminUsersClient projects={projects ?? []} currentUserId={user.id} />
      </main>
    </div>
  )
}
