import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperAdmin(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  return roleData?.role === 'super_admin' ? { user, admin } : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireSuperAdmin(req)
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { audioUrl } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'Missing audioUrl' }, { status: 400 })

  const { error } = await auth.admin.from('projects').update({ audio_url: audioUrl }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ audioUrl })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireSuperAdmin(req)
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await auth.admin.from('projects').update({ audio_url: null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
