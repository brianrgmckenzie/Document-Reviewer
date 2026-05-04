'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    console.log('[login] supabaseUrl:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('[login] authError:', authError)
    console.log('[login] session:', data?.session ? 'present' : 'null')
    console.log('[login] document.cookie after login:', document.cookie)

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div style={{ background: 'white', borderRadius: '10px', padding: '10px 20px', display: 'inline-flex' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/reframe-logo.png" alt="Reframe Concepts" style={{ height: '40px', width: 'auto' }} />
          </div>
        </div>
        <div className="text-center mb-8">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Document Review Platform</p>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="dark-input w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all" />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="dark-input w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all" />
            </div>
            {error && (
              <p className="text-sm px-4 py-2.5 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>{error}</p>
            )}
            <button type="submit" disabled={loading} className="login-btn w-full py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
