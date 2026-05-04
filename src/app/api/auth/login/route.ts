import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  // Call Supabase auth REST API directly — bypasses @supabase/ssr's async
  // onAuthStateChange, which would cause setAll to fire after we return.
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

  // @supabase/ssr stores: storage.setItem(key, JSON.stringify(session))
  // then encodes the cookie as: "base64-" + base64url(storedValue)
  const json = JSON.stringify(session)
  const b64 = Buffer.from(json).toString('base64url')
  const cookieValue = `base64-${b64}`

  // Cookie name: sb-${projectRef}-auth-token
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`

  const response = NextResponse.json({ success: true })
  response.cookies.set(cookieName, cookieValue, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
  })
  return response
}
