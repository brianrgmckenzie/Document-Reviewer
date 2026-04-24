import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTextFromBuffer } from '@/lib/extractText'
import { getEffectiveSession } from '@/lib/getEffectiveSession'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 8000
const VALID_ROLES = new Set(['user', 'assistant'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const session = await getEffectiveSession(user.id, user.email ?? '', roleData?.role ?? null)
  const { role, userId: effectiveUserId, isImpersonating } = session
  const isSuperAdmin = role === 'super_admin'

  const { data: doc } = await admin.from('documents').select('*').eq('id', id).single()
  if (!doc) return new Response('Not found', { status: 404 })

  if (!(isSuperAdmin && !isImpersonating)) {
    const { data: membership } = await admin
      .from('project_members')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('project_id', doc.project_id)
      .single()
    if (!membership) return new Response('Forbidden', { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  if (!body || typeof body !== 'object' || !('messages' in body) || !Array.isArray((body as any).messages)) {
    return new Response('Invalid messages', { status: 400 })
  }

  const messages = (body as any).messages as unknown[]

  if (messages.length > MAX_MESSAGES) {
    return new Response('Too many messages', { status: 400 })
  }

  const validated: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of messages) {
    if (
      !msg || typeof msg !== 'object' ||
      typeof (msg as any).role !== 'string' ||
      typeof (msg as any).content !== 'string' ||
      !VALID_ROLES.has((msg as any).role)
    ) {
      return new Response('Invalid message format', { status: 400 })
    }
    if ((msg as any).content.length > MAX_MESSAGE_LENGTH) {
      return new Response('Message too long', { status: 400 })
    }
    validated.push({ role: (msg as any).role, content: (msg as any).content })
  }

  const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path)
  let documentText: string
  if (fileData) {
    const buffer = Buffer.from(await fileData.arrayBuffer())
    documentText = await extractTextFromBuffer(buffer, doc.file_name)
  } else {
    documentText = [
      doc.summary,
      ...(doc.key_extracts ?? []),
      ...(doc.chief_concerns ?? []),
      ...(doc.consultant_notes ?? []),
    ].filter(Boolean).join('\n\n')
  }

  const systemPrompt = `You are a document research assistant. Your only source of knowledge is the document provided below. You have no awareness of the current date, recent news, or any information outside this document.

Rules:
- Answer only using information explicitly stated in this document.
- If the answer cannot be found in the document, say so clearly — do not guess or draw on general knowledge.
- Do not reference events, people, organizations, or facts not present in the document.
- You may quote or reference specific passages when helpful.
- Be concise and precise.

DOCUMENT: ${doc.title ?? doc.file_name}

${documentText.slice(0, 20000)}`

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: validated,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch {
        controller.error(new Error('Stream failed'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
