import Link from 'next/link'

interface Breadcrumb {
  label: string
  href?: string
}

interface AppNavProps {
  email?: string
  breadcrumbs?: Breadcrumb[]
  isSuperAdmin?: boolean
}

export default function AppNav({ email, breadcrumbs, isSuperAdmin }: AppNavProps) {
  return (
    <header className="app-nav">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: 'linear-gradient(145deg, #3b82f6, #2563eb)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 3px 10px rgba(37,99,235,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-space-grotesk)', fontWeight: 700,
              fontSize: 13, color: 'white', flexShrink: 0,
            }}>R</div>
            <span style={{
              fontFamily: 'var(--font-inter)', fontWeight: 500, fontSize: 14,
              color: 'var(--text-secondary)',
            }}>Document Review</span>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <>
              <div style={{ width: 1, height: 18, background: 'rgba(180,190,220,0.35)', flexShrink: 0 }} />
              <nav className="flex items-center gap-1 text-sm min-w-0">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    {i > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>›</span>
                    )}
                    {crumb.href ? (
                      <Link href={crumb.href} className="nav-crumb-link truncate" style={{ fontSize: 13 }}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {isSuperAdmin && (
            <Link href="/admin/users" className="nav-crumb-link" style={{ fontSize: 13 }}>
              Users
            </Link>
          )}
          {email && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{email}</span>
          )}
          <Link
            href="/api/auth/signout"
            className="dark-btn-outline px-3"
            style={{ display: 'inline-flex', alignItems: 'center', height: 28, borderRadius: 5, fontSize: 12, textDecoration: 'none' }}
          >
            Sign out
          </Link>
        </div>
      </div>
    </header>
  )
}
