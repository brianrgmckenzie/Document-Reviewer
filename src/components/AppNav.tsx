import Link from 'next/link'
import { signoutAction } from '@/app/actions/signout'
import AppLogo from '@/components/AppLogo'

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
            <AppLogo height={22} />
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
          <form action={signoutAction}>
            <button
              type="submit"
              className="dark-btn-outline px-3"
              style={{ display: 'inline-flex', alignItems: 'center', height: 28, borderRadius: 5, fontSize: 12 }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
