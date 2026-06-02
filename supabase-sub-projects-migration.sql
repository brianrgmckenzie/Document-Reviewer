-- Sub-projects migration
-- Run this in the Supabase SQL editor

-- 1. Create sub_projects table
create table sub_projects (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  description text,
  slug text not null,
  status text default 'active' check (status in ('active', 'complete', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(project_id, slug)
);

-- 2. Enable RLS
alter table sub_projects enable row level security;

-- 3. RLS policies
create policy "Project members can view sub_projects"
  on sub_projects for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = sub_projects.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = sub_projects.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can insert sub_projects"
  on sub_projects for insert
  with check (
    exists (
      select 1 from project_members
      where project_members.project_id = sub_projects.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = sub_projects.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can update sub_projects"
  on sub_projects for update
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = sub_projects.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = sub_projects.project_id
      and projects.created_by = auth.uid()
    )
  );

-- 4. Add sub_project_id to documents
alter table documents
  add column if not exists sub_project_id uuid references sub_projects(id) on delete set null;

-- 5. Create "General" sub-project for each existing project
insert into sub_projects (project_id, name, slug, status, description)
select id, 'General', 'general', 'active', 'Migrated from existing documents'
from projects
on conflict (project_id, slug) do nothing;

-- 6. Assign all unassigned documents to their project's "General" sub-project
update documents
set sub_project_id = (
  select sp.id from sub_projects sp
  where sp.project_id = documents.project_id
  and sp.slug = 'general'
  limit 1
)
where sub_project_id is null;
