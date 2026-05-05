'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function loginAction(email: string, password: string): Promise<string | null> {
  const cookieStore = await cookies()

  const cookiesSet: string[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesSet.push(name)
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  console.log('[loginAction] cookiesSet by supabase:', cookiesSet)

  if (error) return error.message

  // Direct test: does cookieStore.set() work at all from a server action?
  cookieStore.set('rc-action-test', 'yes', { path: '/', maxAge: 300, sameSite: 'lax' })
  console.log('[loginAction] set rc-action-test directly')

  redirect('/dashboard')
}
