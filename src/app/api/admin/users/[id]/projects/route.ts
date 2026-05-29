import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyRole } from '@/lib/auth/role'

async function getCallerAndRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  return { user, role: data?.role ?? null }
}

async function canManageProjectMember(callerId: string, callerRole: string | null, projectId: string) {
  if (callerRole === 'super_admin') return true
  if (callerRole !== 'company_admin') return false

  // Company admin can only assign members to projects within their companies
  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  if (!project?.company_id) return false
  const companyRole = await getCompanyRole(callerId, project.company_id)
  return companyRole === 'admin'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerAndRole()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { projectId } = await request.json()

  if (!await canManageProjectMember(caller.user.id, caller.role, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  await admin
    .from('project_members')
    .upsert({ user_id: id, project_id: projectId }, { onConflict: 'project_id,user_id' })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerAndRole()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { projectId } = await request.json()

  if (!await canManageProjectMember(caller.user.id, caller.role, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  await admin
    .from('project_members')
    .delete()
    .eq('user_id', id)
    .eq('project_id', projectId)

  return NextResponse.json({ success: true })
}
