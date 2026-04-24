import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processDocument } from '@/lib/ai/processDocument'
import { extractTextFromBuffer } from '@/lib/extractText'
import { requireProjectAccess } from '@/lib/requireProjectAccess'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const role = roleData?.role ?? null

  let body: { documentId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { documentId } = body
  if (!documentId || typeof documentId !== 'string') {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
  }

  const { data: doc, error: docError } = await admin
    .from('documents')
    .select('file_path, file_name, project_id')
    .eq('id', documentId)
    .single()

  if (docError || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const allowed = await requireProjectAccess(user.id, doc.project_id, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(doc.file_path)
  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
  const buffer = Buffer.from(await fileData.arrayBuffer())
  const textContent = await extractTextFromBuffer(buffer, doc.file_name)

  try {
    const assessment = await processDocument(textContent, doc.file_name)

    let documentDate: string | null = assessment.document_date
    if (documentDate) {
      if (/^\d{4}$/.test(documentDate)) documentDate = `${documentDate}-01-01`
      else if (/^\d{4}-\d{2}$/.test(documentDate)) documentDate = `${documentDate}-01`
    }

    const craapTotal =
      (assessment.craap_currency ?? 5) +
      (assessment.craap_relevance ?? 5) +
      (assessment.craap_authority ?? 5) +
      (assessment.craap_completeness ?? 5) +
      (assessment.craap_purpose ?? 5)

    const { error } = await supabase
      .from('documents')
      .update({
        title: assessment.title,
        document_date: documentDate,
        author: assessment.author,
        source_organization: assessment.source_organization,
        authority_tier: assessment.authority_tier,
        authority_tier_label: assessment.authority_tier_label,
        category: assessment.category,
        relevance_weight: assessment.relevance_weight,
        craap_currency: assessment.craap_currency ?? 5,
        craap_relevance: assessment.craap_relevance ?? 5,
        craap_authority: assessment.craap_authority ?? 5,
        craap_completeness: assessment.craap_completeness ?? 5,
        craap_purpose: assessment.craap_purpose ?? 5,
        craap_total: craapTotal,
        summary: assessment.summary,
        chief_concerns: assessment.chief_concerns,
        consultant_notes: assessment.consultant_notes,
        key_extracts: assessment.key_extracts,
        topics: assessment.topics,
        named_entities: assessment.named_entities,
        key_numbers: assessment.key_numbers,
        sentiment: assessment.sentiment,
        flags: assessment.flags,
        ai_processed: true,
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (error) throw new Error(error.message ?? JSON.stringify(error))

    return NextResponse.json({ success: true, assessment })
  } catch (err) {
    console.error('Document processing error:', err)
    return NextResponse.json({ error: 'Document processing failed' }, { status: 500 })
  }
}
