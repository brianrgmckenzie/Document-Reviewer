import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SECURE = process.env.NODE_ENV === 'production'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (data?.role !== 'super_admin') return null
  return user
}

// POST /api/impersonate — start impersonating a user
export async function POST(request: NextRequest) {
  if (!await requireSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.admin.getUserById(userId)
  if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('rc_impersonate', userId, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })
  return response
}

// DELETE /api/impersonate — exit impersonation
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('rc_impersonate', '', {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
