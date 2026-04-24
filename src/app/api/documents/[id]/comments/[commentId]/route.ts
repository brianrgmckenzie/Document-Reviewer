import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch by both commentId AND document_id to prevent IDOR
  const { data: comment, error: fetchError } = await admin
    .from('document_comments')
    .select('user_id')
    .eq('id', commentId)
    .eq('document_id', id)
    .single()

  if (fetchError || !comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  if (comment.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('document_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
