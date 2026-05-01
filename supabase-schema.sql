-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table (created by Reframe team)
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  client_name text not null,
  description text,
  project_type text, -- e.g. 'faith-based', 'nonprofit', 'land-owning-for-profit'
  slug text unique not null, -- used for the unique client link
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Project admins (Reframe designates who can upload per project)
create table project_admins (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- Documents table
create table documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  uploaded_by uuid references auth.users(id),

  -- File info
  file_name text not null,
  file_path text not null, -- Supabase storage path
  file_type text, -- pdf, docx, xlsx, etc.
  file_size integer,

  -- Document metadata (editable)
  title text,
  document_date date, -- date OF the document, not upload date
  author text,
  source_organization text,

  -- AI Assessment (editable by Reframe)
  authority_tier integer check (authority_tier between 1 and 5), -- 1=Constitutional, 5=Historical
  authority_tier_label text, -- 'Constitutional', 'Regulatory', 'Strategic', 'Operational', 'Historical'
  category text, -- e.g. 'financial', 'governance', 'property', 'strategic', 'correspondence'
  relevance_weight integer check (relevance_weight between 1 and 10), -- AI-assigned 1-10
  summary text, -- AI-generated summary
  key_extracts jsonb, -- array of {quote, significance} objects
  topics text[], -- topic tags
  named_entities jsonb, -- {people: [], orgs: [], properties: [], funders: []}
  key_numbers jsonb, -- {amounts: [], dates: [], units: []}
  sentiment text, -- 'risk', 'commitment', 'aspiration', 'neutral'
  flags text[], -- 'superseded', 'conflict', 'gap-indicator', 'high-priority'

  -- Supersession tracking
  superseded_by uuid references documents(id),
  supersedes uuid references documents(id),

  -- AI processing status
  ai_processed boolean default false,
  ai_processed_at timestamptz,
  ai_model_used text,

  -- Human edits
  human_reviewed boolean default false,
  human_reviewed_by uuid references auth.users(id),
  human_reviewed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conflicts table (when two docs contradict each other)
create table document_conflicts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  document_a uuid references documents(id) on delete cascade,
  document_b uuid references documents(id) on delete cascade,
  conflict_description text,
  resolved boolean default false,
  resolved_note text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table projects enable row level security;
alter table project_admins enable row level security;
alter table documents enable row level security;
alter table document_conflicts enable row level security;

-- RLS Policies
-- Reframe team (authenticated users) can see all projects they created
create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = created_by);

create policy "Users can create projects"
  on projects for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = created_by);

-- Project admins can view projects they are assigned to
create policy "Admins can view assigned projects"
  on projects for select
  using (
    exists (
      select 1 from project_admins
      where project_admins.project_id = projects.id
      and project_admins.user_id = auth.uid()
    )
  );

-- Documents: admins and creators can read/write
create policy "Project members can view documents"
  on documents for select
  using (
    exists (
      select 1 from project_admins
      where project_admins.project_id = documents.project_id
      and project_admins.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = documents.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can insert documents"
  on documents for insert
  with check (
    exists (
      select 1 from project_admins
      where project_admins.project_id = documents.project_id
      and project_admins.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = documents.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can update documents"
  on documents for update
  using (
    exists (
      select 1 from project_admins
      where project_admins.project_id = documents.project_id
      and project_admins.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = documents.project_id
      and projects.created_by = auth.uid()
    )
  );

-- Storage bucket for documents (run this in Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
