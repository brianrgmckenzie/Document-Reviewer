import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectAccess } from '@/lib/requireProjectAccess'
import { filterStopWords } from '@/lib/stopwords'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, query } = await request.json()
  if (!projectId || !query?.trim()) return NextResponse.json({ results: [] })

  const admin = createAdminClient()
  const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single()
  const allowed = await requireProjectAccess(user.id, projectId, roleData?.role ?? null)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get project's custom suppressed words
  const { data: project } = await supabase
    .from('projects')
    .select('search_suppressed_words')
    .eq('id', projectId)
    .single()

  const customWords: string[] = project?.search_suppressed_words ?? []
  const filtered = filterStopWords(query, customWords)

  if (!filtered.trim()) return NextResponse.json({ results: [], filteredQuery: filtered })

  // Search across summary, topics, chief_concerns, consultant_notes, key_extracts
  const terms = filtered.split(/\s+/).filter(Boolean)

  // Build OR conditions for each term across all searchable fields
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, title, file_name, summary, topics, chief_concerns, consultant_notes, key_extracts, category, authority_tier_label, document_date, craap_total, sentiment, flags, relevance_weight')
    .eq('project_id', projectId)
    .eq('ai_processed', true)

  if (error || !documents) return NextResponse.json({ results: [] })

  // Client-side relevance scoring — rank by how many terms match and in which fields
  const scored = documents
    .map(doc => {
      const searchableText = [
        (doc.summary ?? '').toLowerCase(),
        (doc.topics ?? []).join(' ').toLowerCase(),
        (doc.chief_concerns ?? []).join(' ').toLowerCase(),
        (doc.consultant_notes ?? []).join(' ').toLowerCase(),
        (doc.key_extracts ?? []).map((e: unknown) => {
          if (typeof e === 'string') return e
          const ex = e as { quote?: string; significance?: string }
          return `${ex.quote ?? ''} ${ex.significance ?? ''}`
        }).join(' ').toLowerCase(),
        (doc.title ?? doc.file_name ?? '').toLowerCase(),
      ]

      let score = 0
      const matchedTerms: string[] = []

      terms.forEach(term => {
        if (searchableText[0].includes(term)) { score += 3; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // summary
        if (searchableText[1].includes(term)) { score += 5; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // topics (highest weight)
        if (searchableText[2].includes(term)) { score += 3; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // chief_concerns
        if (searchableText[3].includes(term)) { score += 2; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // consultant_notes
        if (searchableText[4].includes(term)) { score += 2; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // key_extracts
        if (searchableText[5].includes(term)) { score += 1; if (!matchedTerms.includes(term)) matchedTerms.push(term) } // title
      })

      // Boost by CRAAP score
      if (score > 0) score += (doc.craap_total ?? 25) / 25

      return { ...doc, _score: score, _matchedTerms: matchedTerms }
    })
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score)

  return NextResponse.json({
    results: scored,
    filteredQuery: filtered,
    termCount: terms.length,
  })
}
