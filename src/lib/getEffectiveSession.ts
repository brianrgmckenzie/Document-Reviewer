import { cookies } from 'next/headers'
import { createAdminClient } from './supabase/admin'

export type EffectiveSession = {
  userId: string
  email: string
  role: string | null
  isImpersonating: boolean
  impersonatedEmail?: string
}

export async function getEffectiveSession(
  realUserId: string,
  realEmail: string,
  realRole: string | null
): Promise<EffectiveSession> {
  const base: EffectiveSession = {
    userId: realUserId,
    email: realEmail,
    role: realRole,
    isImpersonating: false,
  }

  if (realRole !== 'super_admin') return base

  const cookieStore = await cookies()
  const impersonateId = cookieStore.get('rc_impersonate')?.value
  if (!impersonateId || impersonateId === realUserId) return base

  try {
    const admin = createAdminClient()
    const { data: { user }, error } = await admin.auth.admin.getUserById(impersonateId)
    if (error || !user) return base

    const { data: roleData } = await admin
      .from('user_roles').select('role').eq('user_id', impersonateId).single()

    return {
      userId: user.id,
      email: user.email ?? '',
      role: roleData?.role ?? null,
      isImpersonating: true,
      impersonatedEmail: user.email ?? impersonateId,
    }
  } catch {
    return base
  }
}
