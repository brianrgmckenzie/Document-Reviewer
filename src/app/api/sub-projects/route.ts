import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const { project_id, name, description, status } = await request.json()
  if (!project_id || !name?.trim()) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  // Verify caller has access to this project (bypasses RLS gap from using admin client below)
  if (role !== 'super_admin') {
    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const base = toSlug(name.trim())
  let slug = base
  let suffix = 2
  while (true) {
    const { data: existing } = await admin
      .from('sub_projects')
      .select('id')
      .eq('project_id', project_id)
      .eq('slug', slug)
      .single()
    if (!existing) break
    slug = `${base}-${suffix++}`
  }

  const { data: subProject, error } = await admin
    .from('sub_projects')
    .insert({
      project_id,
      name: name.trim(),
      description: description?.trim() || null,
      slug,
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ subProject })
}
