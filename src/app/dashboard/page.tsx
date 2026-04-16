import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewProjectButton from '@/components/NewProjectButton'
import AppLogo from '@/components/AppLogo'
import type { Project } from '@/lib/types'

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  intake:       { label: 'Intake',        bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  under_review: { label: 'Under Review',  bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  complete:     { label: 'Complete',      bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
}

type DocStats = { total: number; unreviewed: number; hasRisk: boolean }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null
  const isSuperAdmin = role === 'super_admin'

  let projects: Project[] = []

  if (isSuperAdmin) {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    projects = data ?? []
  } else {
    const { data: memberships } = await admin.from('project_members').select('project_id').eq('user_id', user.id)
    const projectIds = memberships?.map((m: { project_id: string }) => m.project_id) ?? []
    if (projectIds.length > 0) {
      const { data } = await supabase.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false })
      projects = data ?? []
    }
  }

  // --- Document stats (super_admin only) ---
  const statsByProject: Record<string, DocStats> = {}
  let totalDocs = 0
  let totalUnreviewed = 0
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
    totalUnreviewed = Object.values(statsByProject).reduce((sum, s) => sum + s.unreviewed, 0)
    totalRiskProjects = Object.values(statsByProject).filter(s => s.hasRisk).length
  }

  // Status breakdown
  const statusCounts = { intake: 0, under_review: 0, complete: 0 } as Record<string, number>
  for (const p of projects) statusCounts[p.status ?? 'intake'] = (statusCounts[p.status ?? 'intake'] ?? 0) + 1

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo height={22} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Document Review</span>
          </div>
          <div className="flex items-center gap-5">
            {isSuperAdmin && (
              <Link href="/admin/users" className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
                Users
              </Link>
            )}
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
            <Link href="/api/auth/signout" className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Stats bar — super_admin only */}
        {isSuperAdmin && projects.length > 0 && (
          <div className="dark-card rounded-xl p-5 mb-8 flex flex-wrap gap-6">
            {/* Status breakdown */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Projects</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{projects.length}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['intake', 'under_review', 'complete'] as const).map(s => {
                    const count = statusCounts[s] ?? 0
                    if (!count) return null
                    const style = STATUS_STYLES[s]
                    return (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: style.bg, color: style.color }}>
                        {style.label} {count}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', background: 'var(--border)' }} />

            {/* Document total */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Documents</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{totalDocs}</p>
            </div>

            {/* Awaiting review */}
            {totalUnreviewed > 0 && (
              <>
                <div style={{ width: '1px', background: 'var(--border)' }} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Awaiting Review</p>
                  <p className="text-2xl font-semibold" style={{ color: '#fbbf24' }}>{totalUnreviewed}</p>
                </div>
              </>
            )}

            {/* Risk flags */}
            {totalRiskProjects > 0 && (
              <>
                <div style={{ width: '1px', background: 'var(--border)' }} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Projects w/ Risk Flags</p>
                  <p className="text-2xl font-semibold" style={{ color: '#f87171' }}>{totalRiskProjects}</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
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
            {projects.map((project: Project) => {
              const stats = statsByProject[project.id]
              const statusStyle = STATUS_STYLES[project.status ?? 'intake'] ?? STATUS_STYLES.intake

              return (
                <Link key={project.id} href={`/projects/${project.slug}`} className="project-card block rounded-xl p-6 transition-all">
                  {/* Top row: org type + image */}
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--blue)' }}>
                      {project.project_type ?? 'Client'}
                    </span>
                    {project.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                          <path d="M4 4h8M4 8h8M4 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name + client */}
                  <h3 className="font-semibold mb-1 text-base" style={{ color: 'var(--text-primary)' }}>{project.name}</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
                  {project.description && (
                    <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
                  )}

                  {/* Footer: status + doc stats */}
                  <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                      {statusStyle.label}
                    </span>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {stats ? (
                        <>
                          <span>{stats.total} doc{stats.total !== 1 ? 's' : ''}</span>
                          {stats.unreviewed > 0 && (
                            <span className="font-semibold" style={{ color: '#fbbf24' }}>{stats.unreviewed} to review</span>
                          )}
                          {stats.hasRisk && (
                            <span className="font-semibold" style={{ color: '#f87171' }}>Risk</span>
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
