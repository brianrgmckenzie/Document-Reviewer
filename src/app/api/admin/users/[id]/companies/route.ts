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

// POST — assign user to a company as admin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: userId } = await params
  const { companyId } = await request.json()
  if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('company_members').upsert({ company_id: companyId, user_id: userId, role: 'admin' }, { onConflict: 'company_id,user_id' })
  await admin.from('user_roles').upsert({ user_id: userId, role: 'company_admin' }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true })
}

// DELETE — remove user from a company
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: userId } = await params
  const { companyId } = await request.json()
  if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('company_members').delete().eq('company_id', companyId).eq('user_id', userId)

  // Downgrade to client if no longer in any company
  const { data: remaining } = await admin.from('company_members').select('id').eq('user_id', userId)
  if ((remaining ?? []).length === 0) {
    await admin.from('user_roles').upsert({ user_id: userId, role: 'client' }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ success: true })
}
