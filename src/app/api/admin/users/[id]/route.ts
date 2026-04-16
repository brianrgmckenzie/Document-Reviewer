import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (data?.role !== 'super_admin') return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { role, password, first_name, last_name, organization } = await request.json()
  const admin = createAdminClient()

  if (role) {
    await admin
      .from('user_roles')
      .upsert({ user_id: id, role }, { onConflict: 'user_id' })
  }

  if (password) {
    await admin.auth.admin.updateUserById(id, { password })
  }

  if (first_name !== undefined || last_name !== undefined || organization !== undefined) {
    await admin.from('user_profiles').upsert({
      user_id: id,
      ...(first_name !== undefined && { first_name: first_name?.trim() || null }),
      ...(last_name !== undefined && { last_name: last_name?.trim() || null }),
      ...(organization !== undefined && { organization: organization?.trim() || null }),
    }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()

  await admin.from('project_members').delete().eq('user_id', id)
  await admin.from('user_roles').delete().eq('user_id', id)
  await admin.auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
