import { createAdminClient } from './supabase/admin'

/**
 * Returns true if the user may access the given project.
 * Super-admins always pass. Everyone else must be a project member.
 */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  role: string | null
): Promise<boolean> {
  if (role === 'super_admin') return true

  const admin = createAdminClient()
  const { data } = await admin
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  return !!data
}

/**
 * Resolves the project_id for a document, then checks access.
 */
export async function requireProjectAccessByDocument(
  userId: string,
  documentId: string,
  role: string | null
): Promise<{ allowed: boolean; projectId: string | null }> {
  if (role === 'super_admin') return { allowed: true, projectId: null }

  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documents')
    .select('project_id')
    .eq('id', documentId)
    .single()

  if (!doc) return { allowed: false, projectId: null }

  const { data: member } = await admin
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', doc.project_id)
    .single()

  return { allowed: !!member, projectId: doc.project_id }
}
