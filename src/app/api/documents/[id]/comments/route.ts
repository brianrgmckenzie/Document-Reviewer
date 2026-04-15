import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendCommentNotification } from '@/lib/email'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('document_comments')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body, projectId } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('document_comments')
    .insert({
      document_id: id,
      project_id: projectId,
      user_id: user.id,
      user_email: user.email ?? user.id,
      body: body.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the other party (fire and forget)
  ;(async () => {
    try {
      const admin = createAdminClient()
      const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
      const commenterRole = roleData?.role ?? null

      // Get document title and project info
      const { data: doc } = await admin.from('documents').select('title, file_name').eq('id', id).single()
      const { data: project } = await admin.from('projects').select('name, slug').eq('id', projectId).single()
      if (!doc || !project) return

      const documentTitle = doc.title ?? doc.file_name
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })

      let recipientEmails: string[] = []

      if (commenterRole === 'client') {
        // Notify super_admins + project_admins for this project
        const { data: members } = await admin.from('project_members').select('user_id').eq('project_id', projectId)
        const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
        const { data: staffRoles } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin')
        const superAdminIds = (staffRoles ?? []).map((r: { user_id: string }) => r.user_id)
        const notifyIds = new Set([...memberIds, ...superAdminIds])
        notifyIds.delete(user.id)
        // Filter to non-client roles
        const { data: nonClientRoles } = await admin.from('user_roles').select('user_id, role').in('user_id', [...notifyIds])
        const staffIds = new Set((nonClientRoles ?? []).filter((r: any) => r.role !== 'client').map((r: any) => r.user_id as string))
        recipientEmails = authUsers.filter((u: any) => staffIds.has(u.id) && u.email).map((u: any) => u.email as string)
      } else {
        // Notify clients assigned to this project
        const { data: members } = await admin.from('project_members').select('user_id').eq('project_id', projectId)
        const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
        const { data: clientRoles } = await admin.from('user_roles').select('user_id').in('user_id', memberIds).eq('role', 'client')
        const clientIds = new Set((clientRoles ?? []).map((r: { user_id: string }) => r.user_id))
        clientIds.delete(user.id)
        recipientEmails = authUsers.filter((u: any) => clientIds.has(u.id) && u.email).map((u: any) => u.email as string)
      }

      if (recipientEmails.length > 0) {
        await sendCommentNotification({
          to: recipientEmails,
          commenterEmail: user.email ?? user.id,
          commentBody: body.trim(),
          documentTitle,
          projectName: project.name,
          projectSlug: project.slug,
          documentId: id,
        })
      }
    } catch (err) {
      console.error('Comment notification email failed:', err)
    }
  })()

  return NextResponse.json({ comment: data })
}
