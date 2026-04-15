'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--blue)' }}>
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.6"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.6"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.3"/>
            </svg>
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Reframe Concepts</h1>
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
