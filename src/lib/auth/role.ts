import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type UserRole = 'super_admin' | 'company_admin' | 'project_admin'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  if (!user) return null

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

export async function isCompanyAdmin(): Promise<boolean> {
  return (await getUserRole()) === 'company_admin'
}

export async function getUserProjectIds(userId: string): Promise<string[]> {
  const admin = createAdminClient()

  // Direct project memberships
  const { data: memberships } = await admin
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
  const directIds = memberships?.map((m: { project_id: string }) => m.project_id) ?? []

  // Company admin — access all projects within their companies
  const { data: companyMemberships } = await admin
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .eq('role', 'admin')
  const companyIds = companyMemberships?.map((m: { company_id: string }) => m.company_id) ?? []

  if (companyIds.length === 0) return directIds

  const { data: companyProjects } = await admin
    .from('projects')
    .select('id')
    .in('company_id', companyIds)
  const companyProjectIds = companyProjects?.map((p: { id: string }) => p.id) ?? []

  return [...new Set([...directIds, ...companyProjectIds])]
}

export async function getUserCompanies(userId: string): Promise<{ id: string; name: string; slug: string }[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_members')
    .select('companies(id, name, slug)')
    .eq('user_id', userId)
    .eq('role', 'admin')
  return (data ?? []).map((m: any) => m.companies).filter(Boolean)
}

export async function getCompanyRole(userId: string, companyId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .single()
  return data?.role ?? null
}
