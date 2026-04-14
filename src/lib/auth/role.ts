import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type UserRole = 'super_admin' | 'project_admin'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // Admin client bypasses RLS to safely read user_roles
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return (data?.role as UserRole) ?? null
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getUserRole()) === 'super_admin'
}

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
  return data?.map((m: { project_id: string }) => m.project_id) ?? []
}
