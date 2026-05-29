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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role

  if (role !== 'super_admin' && role !== 'company_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, client_name, description, project_type, company_id } = await request.json()
  if (!name?.trim() || !client_name?.trim()) {
    return NextResponse.json({ error: 'Name and client name are required' }, { status: 400 })
  }

  // Validate company_id
  let resolvedCompanyId: string | null = company_id ?? null

  if (role === 'company_admin') {
    const companies = await getUserCompanies(user.id)
    if (companies.length === 0) {
      return NextResponse.json({ error: 'No company assigned' }, { status: 403 })
    }
    // If company_id provided, verify they belong to it; otherwise use their first company
    if (resolvedCompanyId) {
      if (!companies.some(c => c.id === resolvedCompanyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      resolvedCompanyId = companies[0].id
    }
  }

  // Generate a unique slug
  const base = toSlug(name.trim())
  let slug = base
  let suffix = 2
  while (true) {
    const { data: existing } = await admin.from('projects').select('id').eq('slug', slug).single()
    if (!existing) break
    slug = `${base}-${suffix++}`
  }

  const { data: project, error } = await admin
    .from('projects')
    .insert({
      name: name.trim(),
      client_name: client_name.trim(),
      description: description?.trim() || null,
      project_type: project_type?.trim() || null,
      slug,
      created_by: user.id,
      company_id: resolvedCompanyId,
      status: 'intake',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project })
}
