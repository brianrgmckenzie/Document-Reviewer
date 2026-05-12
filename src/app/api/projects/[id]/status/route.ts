import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendStatusChange } from '@/lib/email'

const VALID_STATUSES = ['intake', 'under_review', 'complete']

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).single()

  if (roleData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status } = await req.json()
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: project, error } = await admin.from('projects').update({ status }).eq('id', id).select('name, slug').single()
  if (error) {
    console.error('Update project status error:', error)
    return NextResponse.json({ error: 'Failed to update project status' }, { status: 500 })
  }

  // Notify clients assigned to this project
  if (project && (status === 'under_review' || status === 'complete')) {
    ;(async () => {
      try {
        // Find client members for this project
        const { data: members } = await admin
          .from('project_members')
          .select('user_id')
          .eq('project_id', id)

        if (members && members.length > 0) {
          const memberIds = members.map((m: { user_id: string }) => m.user_id)
          const { data: roles } = await admin
            .from('user_roles')
            .select('user_id')
            .in('user_id', memberIds)
            .eq('role', 'client')

          if (roles && roles.length > 0) {
            const clientIds = roles.map((r: { user_id: string }) => r.user_id)
            const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
            const clientEmails = authUsers
              .filter((u: { id: string; email?: string | null }) => clientIds.includes(u.id) && u.email)
              .map((u: { email?: string | null }) => u.email as string)

            await sendStatusChange({
              to: clientEmails,
              projectName: project.name,
              projectSlug: project.slug,
              status,
            })
          }
        }
      } catch (err) {
        console.error('Status change email failed:', err)
      }
    })()
  }

  return NextResponse.json({ ok: true })
}
