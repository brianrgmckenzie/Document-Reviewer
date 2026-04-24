-- Migration: add all columns and tables missing from the original schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ── documents: PARCA/CRAAP score columns ─────────────────────────────────────
alter table documents add column if not exists craap_currency    integer;
alter table documents add column if not exists craap_relevance   integer;
alter table documents add column if not exists craap_authority   integer;
alter table documents add column if not exists craap_completeness integer;
alter table documents add column if not exists craap_purpose     integer;
alter table documents add column if not exists craap_total       integer;
alter table documents add column if not exists craap_weighted_total numeric;
alter table documents add column if not exists craap_ai_scores   jsonb;

-- ── documents: AI analysis columns ───────────────────────────────────────────
alter table documents add column if not exists chief_concerns    text[];
alter table documents add column if not exists consultant_notes  text[];
alter table documents add column if not exists quick_scan        jsonb;
alter table documents add column if not exists quick_scanned_at  timestamptz;

-- ── projects: status, image, manuscript, weights ──────────────────────────────
alter table projects add column if not exists status                   text default 'intake';
alter table projects add column if not exists image_url                text;
alter table projects add column if not exists manuscript               text;
alter table projects add column if not exists manuscript_generated_at  timestamptz;
alter table projects add column if not exists craap_weights            jsonb;
alter table projects add column if not exists search_suppressed_words  text[];

-- ── user_roles ────────────────────────────────────────────────────────────────
create table if not exists user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade unique,
  role       text not null check (role in ('super_admin', 'project_admin', 'client')),
  created_at timestamptz default now()
);

-- ── project_members (replaces project_admins for multi-role membership) ───────
create table if not exists project_members (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- ── document_comments ─────────────────────────────────────────────────────────
create table if not exists document_comments (
  id          uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id),
  user_email  text,
  body        text not null,
  created_at  timestamptz default now()
);

-- ── user_profiles (for impersonation display names) ───────────────────────────
create table if not exists user_profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade unique,
  first_name    text,
  last_name     text,
  organization  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── RLS for new tables ────────────────────────────────────────────────────────
alter table user_roles       enable row level security;
alter table project_members  enable row level security;
alter table document_comments enable row level security;
alter table user_profiles    enable row level security;

-- user_roles: only service role (admin client) reads/writes — app uses admin client
create policy if not exists "Service role manages user_roles"
  on user_roles for all using (false);

-- project_members: same
create policy if not exists "Service role manages project_members"
  on project_members for all using (false);

-- document_comments: authenticated users can read; insert own
create policy if not exists "Members can read comments"
  on document_comments for select
  using (auth.uid() is not null);

create policy if not exists "Members can insert comments"
  on document_comments for insert
  with check (auth.uid() = user_id);

-- user_profiles: users can read/update their own
create policy if not exists "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy if not exists "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);
