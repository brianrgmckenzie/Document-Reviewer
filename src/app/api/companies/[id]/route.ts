import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyRole } from '@/lib/auth/role'

async function getCallerRole(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}

async function canAccessCompany(userId: string, globalRole: string | null, companyId: string) {
  if (globalRole === 'super_admin') return true
  if (globalRole === 'company_admin') {
    const companyRole = await getCompanyRole(userId, companyId)
    return companyRole === 'admin'
  }
  return false
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const role = await getCallerRole(user.id)
  if (!await canAccessCompany(user.id, role, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: company, error } = await admin
    .from('companies')
    .select('id, name, slug, created_at')
    .eq('id', id)
    .single()

  if (error || !company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members } = await admin
    .from('company_members')
    .select('user_id, role, created_at')
    .eq('company_id', id)

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, slug, status, created_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  const userIds = (members ?? []).map((m: any) => m.user_id)
  let memberProfiles: any[] = []
  if (userIds.length > 0) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]))
    const emailMap = Object.fromEntries(
      (authUsers?.users ?? []).map((u: any) => [u.id, u.email])
    )
    memberProfiles = (members ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      email: emailMap[m.user_id] ?? null,
      first_name: profileMap[m.user_id]?.first_name ?? null,
      last_name: profileMap[m.user_id]?.last_name ?? null,
    }))
  }

  return NextResponse.json({ company, members: memberProfiles, projects: projects ?? [] })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const role = await getCallerRole(user.id)
  if (!await canAccessCompany(user.id, role, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: company, error } = await admin
    .from('companies')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company })
}
