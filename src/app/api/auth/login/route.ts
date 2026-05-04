import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!authRes.ok) {
    const err = await authRes.json()
    return NextResponse.json(
      { error: err.error_description ?? err.message ?? 'Invalid email or password' },
      { status: 401 }
    )
  }

  const session = await authRes.json()

  const json = JSON.stringify(session)
  const b64 = Buffer.from(json).toString('base64url')
  const cookieValue = `base64-${b64}`

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieSize = cookieName.length + cookieValue.length

  const response = NextResponse.json({
    success: true,
    cookieSize,
    cookieName,
    cookieValueLength: cookieValue.length,
  })

  // Small marker cookie — always fits, confirms this handler ran
  response.cookies.set('rc-login-ok', '1', { path: '/', maxAge: 60, sameSite: 'lax' })

  // The auth cookie — may be dropped silently by browser if > ~4096 bytes total
  response.cookies.set(cookieName, cookieValue, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
  })

  return response
}
