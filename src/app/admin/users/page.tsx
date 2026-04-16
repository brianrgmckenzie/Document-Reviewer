import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminUsersClient from '@/components/AdminUsersClient'
import AppLogo from '@/components/AppLogo'

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
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard"><AppLogo height={18} /></Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Users</span>
          </div>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <AdminUsersClient projects={projects ?? []} currentUserId={user.id} />
      </main>
    </div>
  )
}
