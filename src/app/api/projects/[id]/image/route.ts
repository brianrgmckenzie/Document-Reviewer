import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const path = `${id}/cover.jpg`

  const admin = createAdminClient()

  const { error: storageError } = await admin.storage
    .from('project-images')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('project-images').getPublicUrl(path)
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await admin
    .from('projects')
    .update({ image_url: urlWithBust })
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ url: urlWithBust })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.storage.from('project-images').remove([`${id}/cover.jpg`])
  await admin.from('projects').update({ image_url: null }).eq('id', id)

  return NextResponse.json({ ok: true })
}
