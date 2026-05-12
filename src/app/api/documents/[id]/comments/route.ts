import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendCommentNotification } from '@/lib/email'
import { requireProjectAccess } from '@/lib/requireProjectAccess'

const MAX_COMMENT_LENGTH = 2000

async function getDocumentProjectId(documentId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('documents').select('project_id').eq('id', documentId).single()
  return data?.project_id ?? null
}

async function getUserRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [role, projectId] = await Promise.all([getUserRole(user.id), getDocumentProjectId(id)])
  if (!projectId) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const allowed = await requireProjectAccess(user.id, projectId, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('document_comments')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Fetch comments error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
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

  let body: { body?: unknown; projectId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { body: commentBody, projectId } = body
  if (typeof commentBody !== 'string' || !commentBody.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  }
  if (commentBody.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `Comment exceeds ${MAX_COMMENT_LENGTH} character limit` }, { status: 400 })
  }
  if (typeof projectId !== 'string' || !projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  const role = await getUserRole(user.id)
  const allowed = await requireProjectAccess(user.id, projectId, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('document_comments')
    .insert({
      document_id: id,
      project_id: projectId,
      user_id: user.id,
      user_email: user.email ?? user.id,
      body: commentBody.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('Create comment error:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }

  // Notify the other party (fire and forget)
  ;(async () => {
    try {
      const { data: doc } = await admin.from('documents').select('title, file_name').eq('id', id).single()
      const { data: project } = await admin.from('projects').select('name, slug').eq('id', projectId).single()
      if (!doc || !project) return

      const documentTitle = doc.title ?? doc.file_name
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
      let recipientEmails: string[] = []

      if (role === 'client') {
        const { data: members } = await admin.from('project_members').select('user_id').eq('project_id', projectId)
        const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
        const { data: staffRoles } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin')
        const superAdminIds = (staffRoles ?? []).map((r: { user_id: string }) => r.user_id)
        const notifyIds = new Set([...memberIds, ...superAdminIds])
        notifyIds.delete(user.id)
        const { data: nonClientRoles } = await admin.from('user_roles').select('user_id, role').in('user_id', [...notifyIds])
        const staffIds = new Set((nonClientRoles ?? []).filter((r: any) => r.role !== 'client').map((r: any) => r.user_id as string))
        recipientEmails = authUsers.filter((u: any) => staffIds.has(u.id) && u.email).map((u: any) => u.email as string)
      } else {
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
          commentBody: commentBody.trim(),
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
