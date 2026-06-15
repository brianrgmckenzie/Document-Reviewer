import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectAccess } from '@/lib/requireProjectAccess'

async function getUserRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id)
  if (role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowed = await requireProjectAccess(user.id, id, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch by both reportId AND project_id to prevent IDOR
  const { data: report } = await admin.from('ad_hoc_reports').select('id').eq('id', reportId).eq('project_id', id).single()
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin.from('ad_hoc_reports').delete().eq('id', reportId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
