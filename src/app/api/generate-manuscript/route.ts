import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectAccess } from '@/lib/requireProjectAccess'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARCA_KEYS = ['currency', 'relevance', 'authority', 'completeness', 'purpose'] as const

function computeWeightedPARCA(doc: any, weights: Record<string, number>): number {
  return PARCA_KEYS.reduce((sum, key) => {
    const score = doc[`craap_${key}`] ?? 5
    const weight = weights[key] ?? 1
    return sum + score * weight
  }, 0)
}

function parcaLabel(total: number, max: number): string {
  const pct = total / max
  if (pct >= 0.8) return 'Very High'
  if (pct >= 0.6) return 'High'
  if (pct >= 0.4) return 'Moderate'
  if (pct >= 0.2) return 'Low'
  return 'Very Low'
}

async function getUserRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await request.json()
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const role = await getUserRole(user.id)
  const allowed = await requireProjectAccess(user.id, projectId, role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  const { data: documents } = await admin
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('ai_processed', true)

  if (!documents || documents.length === 0) {
    return NextResponse.json({ error: 'No processed documents found' }, { status: 400 })
  }

  // Get project-level PARCA weights (defaults to 1 each)
  const weights: Record<string, number> = project.craap_weights ?? {
    currency: 1, relevance: 1, authority: 1, completeness: 1, purpose: 1,
  }

  // Compute max possible weighted score
  const maxWeighted = PARCA_KEYS.reduce((sum, key) => sum + 10 * (weights[key] ?? 1), 0)

  // Score and sort documents — highest CRAAP first
  const scored = documents
    .map(doc => ({
      ...doc,
      _weightedScore: computeWeightedPARCA(doc, weights),
    }))
    .sort((a, b) => b._weightedScore - a._weightedScore)

  // Update weighted totals in DB so document cards reflect current weights
  await Promise.all(
    scored.map(doc =>
      admin
        .from('documents')
        .update({ craap_weighted_total: doc._weightedScore })
        .eq('id', doc.id)
    )
  )

  // Build document summaries — ranked by weighted CRAAP
  const docSummaries = scored.map((doc, i) => {
    const rawTotal = doc.craap_total ?? (PARCA_KEYS.reduce((s, k) => s + (doc[`craap_${k}`] ?? 5), 0))
    const weightedScore = doc._weightedScore
    const influence = parcaLabel(weightedScore, maxWeighted)

    return `
DOCUMENT ${i + 1} [PARCA: ${rawTotal}/50 | Weighted: ${weightedScore.toFixed(1)}/${maxWeighted.toFixed(0)} | Influence: ${influence}]
Title: ${doc.title ?? doc.file_name}
Date: ${doc.document_date ?? 'Unknown'} | Category: ${doc.category ?? 'Unknown'} | Tier: ${doc.authority_tier_label ?? 'Unknown'}
PARCA Breakdown — Purpose: ${doc.craap_purpose ?? '?'} | Authority: ${doc.craap_authority ?? '?'} | Relevance: ${doc.craap_relevance ?? '?'} | Completeness: ${doc.craap_completeness ?? '?'} | Accuracy: ${doc.craap_currency ?? '?'}
Sentiment: ${doc.sentiment ?? 'neutral'}
Summary: ${doc.summary ?? 'No summary available'}
Chief Concerns: ${(doc.chief_concerns ?? []).join(' | ') || 'None identified'}
Consultant Notes: ${(doc.consultant_notes ?? []).join(' | ') || 'None'}
Key Extracts: ${(doc.key_extracts ?? []).slice(0, 5).join(' | ') || 'None'}
Key Numbers: ${[...(doc.key_numbers?.amounts ?? []), ...(doc.key_numbers?.units ?? [])].join(' | ') || 'None'}
Flags: ${(doc.flags ?? []).join(', ') || 'None'}
---`
  }).join('\n')

  const prompt = `You are a senior impact consultant at Reframe Concepts completing a comprehensive intake review for a new client engagement.

CLIENT: ${project.client_name}
PROJECT: ${project.name}
TYPE: ${project.project_type ?? 'Unknown'}
${project.description ? `DESCRIPTION: ${project.description}` : ''}

PARCA WEIGHTING APPLIED TO THIS ENGAGEMENT:
Purpose ×${weights.purpose} | Authority ×${weights.authority} | Relevance ×${weights.relevance} | Completeness ×${weights.completeness} | Accuracy ×${weights.currency}
Maximum possible weighted score: ${maxWeighted.toFixed(0)} pts

CRITICAL INSTRUCTION ON WEIGHTING:
The documents below are ranked from highest to lowest weighted PARCA score. Documents with higher PARCA scores have been assessed as more purposeful, authoritative, relevant, complete, and accurate — they should carry more weight in your synthesis. When two documents contain conflicting information, favour the one with the higher PARCA score. When building the narrative, draw more heavily on high-influence documents and treat low-influence documents as supporting context only.

${docSummaries}

Based on this document review, produce a comprehensive intake manuscript. Write as a senior consultant briefing their team: direct, analytical, and actionable. Do not hedge. Name what you see. Ground every claim in specific documents — cite by title when making key assertions.

Structure the manuscript exactly as follows:

# Intake Manuscript: ${project.client_name}

## Executive Overview
3-5 sentences. Where is this organization today? What is the headline story the documents collectively tell? Ground this in your highest-CRAAP documents.

## Organizational Trajectory
How did they get here? Trace the arc from earliest to most recent documents. What has changed, what hasn't, and what does the direction of travel predict about where they are heading?

## Chief Concerns
A numbered list of the most significant concerns, risks, or red flags. Prioritize concerns surfaced by high-CRAAP documents. Be specific — name the document and the issue.

## Strategic Opportunities
What do the documents reveal about genuine opportunities — stated or implied? What assets, relationships, or momentum exist that could be leveraged?

## Governance & Leadership Observations
What do the documents reveal about how this organization makes decisions, who holds power, and whether governance is fit for the challenges ahead?

## Financial Picture
What does the financial evidence suggest about sustainability, risk exposure, and capacity for investment?

## Property & Physical Assets
If applicable — what is known about the organization's physical assets and their strategic role?

## Gaps & Missing Information
What documents or data are conspicuously absent? What questions remain unanswered that the team should prioritize in early client conversations?

## Recommended Focus Areas for Engagement
3-5 specific, prioritized recommendations for where Reframe Concepts should focus first, based on what the documents reveal.

---
*Generated by Reframe Concepts Document Review Platform. Based on ${documents.length} documents. CRAAP-weighted synthesis.*

Write in clear, professional prose. Use bullet points sparingly. This should read like a well-crafted consultant briefing note, not a form or checklist.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const manuscript = response.content[0].type === 'text' ? response.content[0].text : ''

  await admin
    .from('projects')
    .update({
      manuscript,
      manuscript_generated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  return NextResponse.json({ success: true, manuscript })
}
