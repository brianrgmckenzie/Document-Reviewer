import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendUploadNotification } from '@/lib/email'
import { requireProjectAccess } from '@/lib/requireProjectAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null

  let body: { projectId?: unknown; fileName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { projectId, fileName } = body
  if (typeof projectId !== 'string' || !projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }
  if (typeof fileName !== 'string' || !fileName) {
    return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })
  }

  const allowed = await requireProjectAccess(user.id, projectId, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fire and forget — don't block the upload flow
  ;(async () => {
    try {
      const { data: project } = await admin.from('projects').select('name, slug').eq('id', projectId).single()
      if (!project) return

      const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })

      const { data: superAdminRoles } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin')
      const superAdminIds = new Set((superAdminRoles ?? []).map((r: { user_id: string }) => r.user_id))

      const { data: members } = await admin.from('project_members').select('user_id').eq('project_id', projectId)
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
      const { data: memberRoles } = await admin.from('user_roles').select('user_id, role').in('user_id', memberIds)
      const staffMemberIds = new Set(
        (memberRoles ?? []).filter((r: any) => r.role !== 'client').map((r: any) => r.user_id as string)
      )

      const notifyIds = new Set([...superAdminIds, ...staffMemberIds])
      notifyIds.delete(user.id)

      const recipientEmails = authUsers
        .filter((u: any) => notifyIds.has(u.id) && u.email)
        .map((u: any) => u.email as string)

      if (recipientEmails.length > 0) {
        await sendUploadNotification({
          to: recipientEmails,
          uploaderEmail: user.email ?? user.id,
          fileName,
          projectName: project.name,
          projectSlug: project.slug,
        })
      }
    } catch (err) {
      console.error('Upload notification email failed:', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
