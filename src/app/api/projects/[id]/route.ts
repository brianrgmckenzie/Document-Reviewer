import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove all document files from storage first
  const { data: docs } = await admin.from('documents').select('file_path').eq('project_id', id)
  if (docs && docs.length > 0) {
    const paths = docs.map((d: { file_path: string }) => d.file_path).filter(Boolean)
    if (paths.length > 0) await admin.storage.from('documents').remove(paths)
  }

  // Delete documents, members, then the project (FK order)
  await admin.from('documents').delete().eq('project_id', id)
  await admin.from('project_members').delete().eq('project_id', id)
  const { error } = await admin.from('projects').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Only allow updating safe fields via this route
  const allowed = ['image_url']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('projects').update(update).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
