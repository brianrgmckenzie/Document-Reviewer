import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { enabled } = await req.json()

  const { data: existing } = await admin.from('projects').select('share_token').eq('id', id).single()

  const updates: Record<string, unknown> = { share_enabled: enabled }
  if (!existing?.share_token) {
    updates.share_token = crypto.randomUUID()
  }

  const { data, error } = await admin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('share_token, share_enabled')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shareToken: data.share_token, shareEnabled: data.share_enabled })
}
