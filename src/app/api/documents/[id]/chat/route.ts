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

  const reqBody = body as { messages?: unknown[] }
  if (!reqBody || typeof reqBody !== 'object' || !('messages' in reqBody) || !Array.isArray(reqBody.messages)) {
    return new Response('Invalid messages', { status: 400 })
  }

  const messages = reqBody.messages

  if (messages.length > MAX_MESSAGES) {
    return new Response('Too many messages', { status: 400 })
  }

  const validated: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of messages) {
    const m = msg as { role?: string; content?: string }
    if (
      !m || typeof m !== 'object' ||
      typeof m.role !== 'string' ||
      typeof m.content !== 'string' ||
      !VALID_ROLES.has(m.role)
    ) {
      return new Response('Invalid message format', { status: 400 })
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return new Response('Message too long', { status: 400 })
    }
    validated.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }

  let documentText: string
  if (doc.extracted_text) {
    documentText = doc.extracted_text
  } else {
    const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path)
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      documentText = await extractTextFromBuffer(buffer, doc.file_name)
      await admin.from('documents').update({ extracted_text: documentText }).eq('id', id)
    } else {
      documentText = [
        doc.summary,
        ...(doc.key_extracts ?? []).map((e: unknown) => {
          if (typeof e === 'string') return e
          const ex = e as { quote?: string; significance?: string }
          return `"${ex.quote ?? ''}" — ${ex.significance ?? ''}`
        }),
        ...(doc.chief_concerns ?? []),
        ...(doc.consultant_notes ?? []),
      ].filter(Boolean).join('\n\n')
    }
  }

  const systemPrompt = `You are a document research assistant. Your only source of knowledge is the document provided below. You have no awareness of the current date, recent news, or any information outside this document.

Rules:
- Answer only using information explicitly stated in this document.
- If the answer cannot be found in the document, say so clearly — do not guess or draw on general knowledge.
- Do not reference events, people, organizations, or facts not present in the document.
- You may quote or reference specific passages when helpful.
- Be concise and precise.

DOCUMENT: ${doc.title ?? doc.file_name}

${documentText.slice(0, 80000)}`

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
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
