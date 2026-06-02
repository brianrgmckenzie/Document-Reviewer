import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeClient, sendWelcomeStaff } from '@/lib/email'

async function getCallerAndRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  return { user, role: data?.role ?? null }
}

export async function GET() {
  const caller = await getCallerAndRole()
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: roles } = await admin.from('user_roles').select('user_id, role')
  const { data: memberships } = await admin
    .from('project_members')
    .select('user_id, project_id, projects(id, name, slug)')
  const { data: companyMemberships } = await admin
    .from('company_members')
    .select('user_id, company_id, companies(id, name, slug)')
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('user_id, first_name, last_name, organization')

  const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.user_id, r.role]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]))

  const membershipMap: Record<string, { id: string; name: string; slug: string }[]> = {}
  for (const m of memberships ?? []) {
    if (!membershipMap[m.user_id]) membershipMap[m.user_id] = []
    if (m.projects) membershipMap[m.user_id].push(m.projects as unknown as { id: string; name: string; slug: string })
  }

  const companyMap: Record<string, { id: string; name: string; slug: string }[]> = {}
  for (const m of companyMemberships ?? []) {
    if (!companyMap[m.user_id]) companyMap[m.user_id] = []
    if (m.companies) companyMap[m.user_id].push(m.companies as unknown as { id: string; name: string; slug: string })
  }

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: roleMap[u.id] ?? null,
    projects: membershipMap[u.id] ?? [],
    companies: companyMap[u.id] ?? [],
    first_name: profileMap[u.id]?.first_name ?? null,
    last_name: profileMap[u.id]?.last_name ?? null,
    organization: profileMap[u.id]?.organization ?? null,
  }))

  return NextResponse.json({ users: result })
}

export async function POST(request: NextRequest) {
  const caller = await getCallerAndRole()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isSuperAdmin = caller.role === 'super_admin'
  const isCompanyAdmin = caller.role === 'company_admin'

  if (!isSuperAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify company_admin still has an active company membership
  if (isCompanyAdmin) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('company_members')
      .select('id')
      .eq('user_id', caller.user.id)
      .eq('role', 'admin')
      .limit(1)
      .single()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, password, role, first_name, last_name, organization } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // Company admins can only create client (project member) accounts
  const assignedRole = isCompanyAdmin ? 'client' : (role ?? 'client')
  if (isCompanyAdmin && role && role !== 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: { user }, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !user) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create user' }, { status: 500 })
  }

  await admin.from('user_roles').insert({ user_id: user.id, role: assignedRole })

  if (first_name || last_name || organization) {
    await admin.from('user_profiles').insert({
      user_id: user.id,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      organization: organization?.trim() || null,
    })
  }

  if (user.email) {
    const send = assignedRole === 'client'
      ? sendWelcomeClient({ to: user.email, tempPassword: password })
      : sendWelcomeStaff({ to: user.email, role: assignedRole, tempPassword: password })
    send.catch(err => console.error('Welcome email failed:', err))
  }

  return NextResponse.json({ user: { id: user.id, email: user.email, role: assignedRole } })
}
