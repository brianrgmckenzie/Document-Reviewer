import { createAdminClient } from './supabase/admin'

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  role: string | null
): Promise<boolean> {
  if (role === 'super_admin') return true

  const admin = createAdminClient()

  // Direct project membership
  const { data: member } = await admin
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()
  if (member) return true

  // Company admin access via project's company
  const { data: project } = await admin
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  if (project?.company_id) {
    const { data: companyMember } = await admin
      .from('company_members')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', project.company_id)
      .eq('role', 'admin')
      .single()
    if (companyMember) return true
  }

  return false
}

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

  const allowed = await requireProjectAccess(userId, doc.project_id, role)
  return { allowed, projectId: doc.project_id }
}
