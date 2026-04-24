import Anthropic from '@anthropic-ai/sdk'
import { type AuthorityTier, type DocumentCategory, type Sentiment } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface AIDocumentAssessment {
  title: string
  document_date: string | null
  author: string | null
  source_organization: string | null
  authority_tier: AuthorityTier
  authority_tier_label: string
  category: DocumentCategory
  relevance_weight: number
  craap_currency: number
  craap_relevance: number
  craap_authority: number
  craap_completeness: number
  craap_purpose: number
  summary: string
  chief_concerns: string[]
  consultant_notes: string[]
  key_extracts: string[]
  topics: string[]
  named_entities: {
    people: string[]
    orgs: string[]
    properties: string[]
    funders: string[]
  }
  key_numbers: {
    amounts: string[]
    dates: string[]
    units: string[]
  }
  sentiment: Sentiment
  flags: string[]
}

export async function processDocument(
  textContent: string,
  fileName: string
): Promise<AIDocumentAssessment> {
  const prompt = `You are a senior impact consultant at Reframe Concepts — a firm that works with faith-based organizations, nonprofits, and land-owning for-profits to achieve long-term sustainability, governance, and community impact.

You are conducting a document intake review. Your job is to read this document the way an experienced consultant would — not just summarizing what it says, but interpreting what it reveals, what it implies, and what it should make the engagement team pay attention to.

DOCUMENT FILENAME: ${fileName}

DOCUMENT CONTENT:
${textContent.slice(0, 15000)}

Produce a JSON assessment with the following fields:

{
  "title": "A clear, descriptive title for this document",
  "document_date": "YYYY-MM-DD or YYYY-MM or YYYY if found, null if not determinable",
  "author": "Author name(s) if found, null otherwise",
  "source_organization": "Organization that produced this document, null if not clear",

  "authority_tier": <1-5 integer>,
  // 1 = Constitutional: bylaws, land title, incorporation, legal agreements
  // 2 = Regulatory: audited financials, zoning orders, engineering reports, government docs
  // 3 = Strategic: strategic plans, vision documents, business cases
  // 4 = Operational: board minutes, budgets, correspondence, internal memos
  // 5 = Historical: old reports, prior assessments, archived context

  "authority_tier_label": "Constitutional|Regulatory|Strategic|Operational|Historical",

  "category": "one of: governance|financial|property|strategic|legal|correspondence|report|funding|operational|other",

  "relevance_weight": <1-10 integer>,
  // 10 = critically central to understanding this organization
  // 1 = peripheral/low value for intake purposes

  "craap_currency": <1-10 integer>,
  // Accuracy: The reliability and truthfulness of the content.
  // 10 = claims are well-supported, internally consistent, and verifiable against authoritative sources
  // 1 = unverified, anecdotal, self-reported without evidence, or contains apparent inaccuracies

  "craap_relevance": <1-10 integer>,
  // Relevance: The importance of the information for the engagement's specific needs.
  // 10 = directly answers key questions and fits the engagement topic
  // 1 = tangential or peripheral to the engagement scope

  "craap_authority": <1-10 integer>,
  // Authority: The source of the information — author credentials and publisher reputation.
  // 10 = external auditor, legal authority, government body, credentialed expert
  // 1 = informal internal note, unknown author, unverified correspondence

  "craap_completeness": <1-10 integer>,
  // Currency: The timeliness of the information — publication date and whether it is up to date.
  // 10 = recent, current, and reflects the latest available information
  // 1 = outdated, superseded, or no date determinable

  "craap_purpose": <1-10 integer>,
  // Purpose: The reason the information exists — to inform, teach, sell, entertain, or persuade.
  // 10 = clearly informational or educational, objective, transparently sourced
  // 1 = promotional, persuasive, or agenda-driven with undisclosed bias

  "summary": "2-4 sentence factual summary of what this document is and what it establishes about the organization",

  "chief_concerns": [
    "Array of 3-6 specific concerns, risks, red flags, or unresolved tensions a consultant would flag after reading this document. Be direct and specific — not vague. Examples: 'Governance structure gives single board member veto power over all financial decisions', 'No succession plan mentioned despite aging leadership', 'Zoning approval contingent on community consultation that has not occurred'"
  ],

  "consultant_notes": [
    "Array of 3-5 interpretive observations — what this document implies about the organization beyond what it literally says. Think: what patterns does this suggest, what questions does it raise, what does it predict about where this org is heading? Examples: 'The gap between the 2019 vision and 2023 actuals suggests either scope creep or capacity issues — worth probing', 'Tone shifts mid-document from confident to hedging, which may indicate internal disagreement at time of writing'"
  ],

  "key_extracts": [
    "Array of 3-8 verbatim or near-verbatim quotes of the most important statements, figures, or commitments from the document"
  ],

  "topics": ["array", "of", "topic", "tags"],

  "named_entities": {
    "people": ["names of key individuals mentioned"],
    "orgs": ["other organizations referenced"],
    "properties": ["specific properties, addresses, or locations"],
    "funders": ["funding sources or grant bodies"]
  },

  "key_numbers": {
    "amounts": ["dollar figures with context, e.g. '$4.2M property valuation (2024 appraisal)'"],
    "dates": ["significant dates and deadlines mentioned"],
    "units": ["unit counts, percentages, capacities, e.g. '250 housing units — 161 supportive, 90 blended'"]
  },

  "sentiment": "risk|commitment|aspiration|neutral",
  // risk = flags problems, liabilities, or threats
  // commitment = records decisions, obligations, or agreements
  // aspiration = forward-looking goals and vision
  // neutral = factual/informational

  "flags": []
  // Include any applicable: "high-priority", "requires-legal-review", "conflict-indicator", "outdated", "incomplete", "gap-indicator"
}

Return ONLY valid JSON. No explanation, no markdown, just the JSON object.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0] : text
  // Strip // line comments that Claude sometimes echoes from the prompt template
  const cleaned = raw.replace(/\/\/[^\n]*/g, '')

  try {
    return JSON.parse(cleaned) as AIDocumentAssessment
  } catch {
    throw new Error('Failed to parse AI assessment response')
  }
}
