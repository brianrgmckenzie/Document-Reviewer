import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeClient, sendWelcomeStaff } from '@/lib/email'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (data?.role !== 'super_admin') return null
  return user
}

export async function GET() {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: roles } = await admin.from('user_roles').select('user_id, role')
  const { data: memberships } = await admin
    .from('project_members')
    .select('user_id, project_id, projects(id, name, slug)')
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

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: roleMap[u.id] ?? null,
    projects: membershipMap[u.id] ?? [],
    first_name: profileMap[u.id]?.first_name ?? null,
    last_name: profileMap[u.id]?.last_name ?? null,
    organization: profileMap[u.id]?.organization ?? null,
  }))

  return NextResponse.json({ users: result })
}

export async function POST(request: NextRequest) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password, role, first_name, last_name, organization } = await request.json()
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
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

  await admin.from('user_roles').insert({ user_id: user.id, role })

  if (first_name || last_name || organization) {
    await admin.from('user_profiles').insert({
      user_id: user.id,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      organization: organization?.trim() || null,
    })
  }

  if (user.email) {
    const send = role === 'client'
      ? sendWelcomeClient({ to: user.email, tempPassword: password })
      : sendWelcomeStaff({ to: user.email, role, tempPassword: password })
    send.catch(err => console.error('Welcome email failed:', err))
  }

  return NextResponse.json({ user: { id: user.id, email: user.email, role } })
}
