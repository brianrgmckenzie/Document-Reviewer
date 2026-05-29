import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewProjectButton from '@/components/NewProjectButton'
import AppNav from '@/components/AppNav'
import { getEffectiveSession } from '@/lib/getEffectiveSession'
import type { Project } from '@/lib/types'

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  intake:       { label: 'Intake',        bg: 'var(--warning-dim)',  color: 'var(--warning)' },
  under_review: { label: 'Under Review',  bg: 'var(--accent-dim)',   color: 'var(--accent)' },
  complete:     { label: 'Complete',      bg: 'var(--success-dim)',  color: 'var(--success)' },
}

type DocStats = { total: number; unreviewed: number; hasRisk: boolean }

function projectInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

const PROJECT_COLORS = ['#4f7cff', '#9b7dff', '#2dd88a', '#f5a623', '#ff4d4d', '#38bdf8']
function projectColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return PROJECT_COLORS[h % PROJECT_COLORS.length]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const realRole = roleData?.role ?? null
  const session = await getEffectiveSession(user.id, user.email ?? '', realRole)
  const { role, userId: effectiveUserId, isImpersonating } = session
  const isSuperAdmin = role === 'super_admin'

  let projects: Project[] = []

  if (isSuperAdmin && !isImpersonating) {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    projects = data ?? []
  } else {
    const { data: memberships } = await admin.from('project_members').select('project_id').eq('user_id', effectiveUserId)
    const projectIds = memberships?.map((m: { project_id: string }) => m.project_id) ?? []
    if (projectIds.length > 0) {
      const { data } = await supabase.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false })
      projects = data ?? []
    }
  }

  const statsByProject: Record<string, DocStats> = {}
  let totalDocs = 0
  let totalRiskProjects = 0

  if (isSuperAdmin && projects.length > 0) {
    const projectIds = projects.map(p => p.id)
    const { data: docs } = await admin
      .from('documents')
      .select('project_id, ai_processed, human_reviewed, flags, sentiment')
      .in('project_id', projectIds)

    for (const doc of docs ?? []) {
      if (!statsByProject[doc.project_id]) {
        statsByProject[doc.project_id] = { total: 0, unreviewed: 0, hasRisk: false }
      }
      const s = statsByProject[doc.project_id]
      s.total++
      if (doc.ai_processed && !doc.human_reviewed) s.unreviewed++
      if ((doc.flags ?? []).includes('high-priority') || doc.sentiment === 'risk') s.hasRisk = true
    }

    totalDocs = Object.values(statsByProject).reduce((sum, s) => sum + s.total, 0)
    totalRiskProjects = Object.values(statsByProject).filter(s => s.hasRisk).length
  }

  const statusCounts = { intake: 0, under_review: 0, complete: 0 } as Record<string, number>
  for (const p of projects) statusCounts[p.status ?? 'intake'] = (statusCounts[p.status ?? 'intake'] ?? 0) + 1

  return (
    <div className="min-h-screen fade-up" style={{ background: 'var(--background)' }}>
      <AppNav email={user.email} isSuperAdmin={isSuperAdmin} />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Stats bar — super_admin only */}
        {isSuperAdmin && projects.length > 0 && (
          <div className="dark-card mb-8 overflow-hidden" style={{ borderRadius: 14 }}>
            <div className="grid grid-cols-3">
              {/* Projects */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Projects</p>
                <p className="mb-2" style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {projects.length}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['intake', 'under_review', 'complete'] as const).map(s => {
                    const count = statusCounts[s] ?? 0
                    if (!count) return null
                    const st = STATUS_STYLES[s]
                    return (
                      <span key={s} className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: st.bg, color: st.color, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11 }}>
                        {st.label} {count}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Documents */}
              <div className="px-6 py-5" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Documents</p>
                <p className="mb-2" style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {totalDocs}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Across all active projects</p>
              </div>

              {/* Risk */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Projects w/ Risk Flags</p>
                <p className="mb-2" style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 28, color: totalRiskProjects > 0 ? 'var(--risk)' : 'var(--text-primary)', lineHeight: 1 }}>
                  {totalRiskProjects}
                </p>
                {totalRiskProjects > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="risk-dot" />
                    <span className="text-xs font-medium" style={{ color: 'var(--risk)' }}>Requires attention</span>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No active risk flags</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 22, color: 'var(--text-primary)' }}>Projects</h2>
            {!isSuperAdmin && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {projects.length} engagement{projects.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {isSuperAdmin && <NewProjectButton />}
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project, idx: number) => {
              const stats = statsByProject[project.id]
              const statusStyle = STATUS_STYLES[project.status ?? 'intake'] ?? STATUS_STYLES.intake
              const hasRisk = stats?.hasRisk ?? false
              const initials = projectInitials(project.name)
              const color = projectColor(project.id)

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className={`project-card block p-5 ${hasRisk ? 'has-risk' : ''}`}
                  style={{ animationDelay: `${idx * 0.06}s`, animationFillMode: 'both', textDecoration: 'none' }}
                >
                  <div className="card-accent-line" />

                  {/* Top row: badge + logo mark */}
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                      {project.project_type ?? 'Client'}
                    </span>
                    {project.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.image_url} alt="" className="rounded-lg object-cover shrink-0" style={{ width: 36, height: 36, border: '1px solid var(--border)' }} />
                    ) : (
                      <div className="rounded-lg flex items-center justify-center shrink-0" style={{
                        width: 36, height: 36,
                        background: `${color}22`,
                        border: `1px solid ${color}44`,
                        fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                        fontSize: 12, color,
                      }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Name + client */}
                  <h3 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4 }}>
                    {project.name}
                  </h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                  {project.description && (
                    <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{project.description}</p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: statusStyle.bg, color: statusStyle.color, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>
                      {statusStyle.label}
                    </span>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {stats ? (
                        <>
                          <span>{stats.total} doc{stats.total !== 1 ? 's' : ''}</span>
                          {stats.unreviewed > 0 && (
                            <span className="font-semibold" style={{ color: 'var(--warning)' }}>{stats.unreviewed} to review</span>
                          )}
                          {hasRisk && (
                            <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--risk)', fontSize: 11 }}>
                              <span className="risk-dot" style={{ width: 6, height: 6 }} />
                              Risk
                            </span>
                          )}
                        </>
                      ) : (
                        <span>No documents</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {isSuperAdmin ? (
              <>
                <p className="mb-5" style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
                <NewProjectButton />
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No projects assigned to your account yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
