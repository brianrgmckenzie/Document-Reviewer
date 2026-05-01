import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { extractTextFromBuffer } from '@/lib/extractText'
import { requireProjectAccess } from '@/lib/requireProjectAccess'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const { data: doc } = await admin
    .from('documents')
    .select('file_path, file_name, project_id')
    .eq('id', documentId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const allowed = await requireProjectAccess(user.id, doc.project_id, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path)
  if (!fileData) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  const buffer = Buffer.from(await fileData.arrayBuffer())
  const textContent = await extractTextFromBuffer(buffer, doc.file_name)

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are doing a rapid 10-second intake scan of a document for a consulting firm.

FILENAME: ${doc.file_name}
CONTENT (first pages only):
${textContent.slice(0, 3000)}

Return JSON only:
{
  "title": "Clear document title",
  "document_type": "One phrase — what kind of document is this",
  "date_estimate": "Year or date if visible, null if not",
  "headline": "One sentence: what is this document and why does it matter for understanding this organization",
  "worth_full_processing": true or false,
  "skip_reason": "If false, why — otherwise null"
}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let scan: Record<string, unknown> = {}
    try {
      scan = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) scan = JSON.parse(match[0])
    }

    await admin.from('documents').update({
      title: scan.title as string ?? null,
      quick_scan: scan,
      quick_scanned_at: new Date().toISOString(),
      extracted_text: textContent,
    }).eq('id', documentId)

    return NextResponse.json({ success: true, scan })
  } catch (err) {
    console.error('Quick scan error:', err)
    return NextResponse.json({ error: 'Quick scan failed' }, { status: 500 })
  }
}
