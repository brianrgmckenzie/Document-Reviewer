import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const setTest = url.searchParams.get('set') === '1'

  if (setTest) {
    const res = NextResponse.json({ message: 'Test cookie set. Now visit /api/debug-auth (without ?set=1) to verify.' })
    res.cookies.set('rc-test', 'works', { path: '/', maxAge: 3600, sameSite: 'lax' })
    return res
  }

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  const testCookie = allCookies.find(c => c.name === 'rc-test')
  const loginOk = allCookies.find(c => c.name === 'rc-login-ok')

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message ?? null,
    supabaseCookieCount: supabaseCookies.length,
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    totalCookieCount: allCookies.length,
    testCookie: testCookie?.value ?? null,
    loginHandlerRan: loginOk ? true : false,
  })
}
