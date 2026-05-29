import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import NewCompanyButton from '@/components/NewCompanyButton'

export default async function AdminCompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'super_admin') redirect('/dashboard')

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, slug, created_at')
    .order('name')

  const companyIds = (companies ?? []).map((c: any) => c.id)
  const { data: projectCounts } = companyIds.length > 0
    ? await admin.from('projects').select('company_id').in('company_id', companyIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const p of projectCounts ?? []) {
    countMap[p.company_id] = (countMap[p.company_id] ?? 0) + 1
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppNav
        email={user.email}
        isSuperAdmin={true}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Companies' }]}
      />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Companies</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {(companies ?? []).length} compan{(companies ?? []).length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
          <NewCompanyButton />
        </div>

        {(companies ?? []).length === 0 ? (
          <div className="text-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mb-5" style={{ color: 'var(--text-secondary)' }}>No companies yet.</p>
            <NewCompanyButton />
          </div>
        ) : (
          <div className="space-y-3">
            {(companies ?? []).map((company: any) => (
              <Link
                key={company.id}
                href={`/admin/companies/${company.id}`}
                className="dark-card block rounded-xl p-5 hover:border-[var(--border-hover)] transition-colors"
                style={{ textDecoration: 'none' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{company.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {countMap[company.id] ?? 0} project{(countMap[company.id] ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Manage →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
