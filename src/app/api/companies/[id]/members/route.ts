import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeCompanyAdmin } from '@/lib/email'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (data?.role !== 'super_admin') return null
  return user
}

// POST — create a new user and make them company_admin for this company
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: companyId } = await params
  const { email, password, first_name, last_name } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify company exists
  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const { data: { user }, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  await admin.from('user_roles').insert({ user_id: user.id, role: 'company_admin' })
  await admin.from('company_members').insert({ company_id: companyId, user_id: user.id, role: 'admin' })

  if (first_name || last_name) {
    await admin.from('user_profiles').insert({
      user_id: user.id,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
    })
  }

  if (user.email) {
    sendWelcomeCompanyAdmin({
      to: user.email,
      companyName: company.name,
      tempPassword: password,
    }).catch(err => console.error('Welcome email failed:', err))
  }

  return NextResponse.json({ user: { id: user.id, email: user.email } })
}

// PATCH — assign an existing user as company_admin for this company
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: companyId } = await params
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: company } = await admin.from('companies').select('id').eq('id', companyId).single()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Find the existing auth user by email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase())
  if (!existing) return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })

  // Check not already a member
  const { data: alreadyMember } = await admin
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', existing.id)
    .single()
  if (alreadyMember) return NextResponse.json({ error: 'User is already an admin of this company' }, { status: 409 })

  await admin.from('company_members').insert({ company_id: companyId, user_id: existing.id, role: 'admin' })
  await admin.from('user_roles').upsert({ user_id: existing.id, role: 'company_admin' }, { onConflict: 'user_id' })

  const { data: profile } = await admin.from('user_profiles').select('first_name, last_name').eq('user_id', existing.id).single()

  return NextResponse.json({
    user: {
      user_id: existing.id,
      role: 'admin',
      email: existing.email,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
    }
  })
}

// DELETE — remove a company admin (removes from company_members; keeps auth user)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: companyId } = await params
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('company_members').delete().eq('company_id', companyId).eq('user_id', userId)

  // Check if user still belongs to any other company; if not, downgrade role
  const { data: remaining } = await admin
    .from('company_members')
    .select('id')
    .eq('user_id', userId)
  if ((remaining ?? []).length === 0) {
    await admin.from('user_roles').update({ role: 'client' }).eq('user_id', userId)
  }

  return NextResponse.json({ success: true })
}
