import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompanies } from '@/lib/auth/role'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

async function getCallerRole(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(user.id)
  const admin = createAdminClient()

  if (role === 'super_admin') {
    const { data: companies, error } = await admin
      .from('companies')
      .select('id, name, slug, created_at')
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ companies })
  }

  if (role === 'company_admin') {
    const companies = await getUserCompanies(user.id)
    return NextResponse.json({ companies })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(user.id)
  if (role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const base = toSlug(name.trim())
  let slug = base
  let suffix = 2
  while (true) {
    const { data: existing } = await admin.from('companies').select('id').eq('slug', slug).single()
    if (!existing) break
    slug = `${base}-${suffix++}`
  }

  const { data: company, error } = await admin
    .from('companies')
    .insert({ name: name.trim(), slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ company })
}
