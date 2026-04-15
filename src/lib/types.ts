export type AuthorityTier = 1 | 2 | 3 | 4 | 5

export const AUTHORITY_TIER_LABELS: Record<AuthorityTier, string> = {
  1: 'Constitutional',
  2: 'Regulatory',
  3: 'Strategic',
  4: 'Operational',
  5: 'Historical',
}

export const AUTHORITY_TIER_DESCRIPTIONS: Record<AuthorityTier, string> = {
  1: 'Governing & legal documents — bylaws, land title, incorporation',
  2: 'External authority — audited financials, zoning orders, engineering reports',
  3: 'Organizational intent — strategic plans, vision documents',
  4: 'Day-to-day record — board minutes, budgets, correspondence',
  5: 'Archive & context — old reports, prior assessments',
}

export const DOCUMENT_CATEGORIES = [
  'governance',
  'financial',
  'property',
  'strategic',
  'legal',
  'correspondence',
  'report',
  'funding',
  'operational',
  'other',
] as const

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]

export const SENTIMENT_OPTIONS = ['risk', 'commitment', 'aspiration', 'neutral'] as const
export type Sentiment = typeof SENTIMENT_OPTIONS[number]

export interface Project {
  id: string
  name: string
  client_name: string
  description: string | null
  project_type: string | null
  slug: string
  status: string | null
  created_by: string
  created_at: string
  updated_at: string
  image_url: string | null
  manuscript: string | null
  manuscript_generated_at: string | null
  craap_weights: Record<string, number> | null
  search_suppressed_words: string[] | null
}

export interface Document {
  id: string
  project_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  title: string | null
  document_date: string | null
  author: string | null
  source_organization: string | null
  authority_tier: AuthorityTier | null
  authority_tier_label: string | null
  category: DocumentCategory | null
  relevance_weight: number | null
  summary: string | null
  key_extracts: string[] | null
  topics: string[] | null
  named_entities: {
    people: string[]
    orgs: string[]
    properties: string[]
    funders: string[]
  } | null
  key_numbers: {
    amounts: string[]
    dates: string[]
    units: string[]
  } | null
  sentiment: Sentiment | null
  flags: string[] | null
  superseded_by: string | null
  supersedes: string | null
  ai_processed: boolean
  ai_processed_at: string | null
  human_reviewed: boolean
  human_reviewed_by: string | null
  human_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentConflict {
  id: string
  project_id: string
  document_a: string
  document_b: string
  conflict_description: string | null
  resolved: boolean
  resolved_note: string | null
  created_at: string
}
