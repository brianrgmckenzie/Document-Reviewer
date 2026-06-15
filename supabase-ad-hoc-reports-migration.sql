-- Ad hoc reports migration
-- Run this in the Supabase SQL editor

create table ad_hoc_reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  prompt text not null,
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index ad_hoc_reports_project_id_idx on ad_hoc_reports(project_id);

alter table ad_hoc_reports enable row level security;

create policy "Project members can view ad_hoc_reports"
  on ad_hoc_reports for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = ad_hoc_reports.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = ad_hoc_reports.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can insert ad_hoc_reports"
  on ad_hoc_reports for insert
  with check (
    exists (
      select 1 from project_members
      where project_members.project_id = ad_hoc_reports.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = ad_hoc_reports.project_id
      and projects.created_by = auth.uid()
    )
  );

create policy "Project members can delete ad_hoc_reports"
  on ad_hoc_reports for delete
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = ad_hoc_reports.project_id
      and project_members.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where projects.id = ad_hoc_reports.project_id
      and projects.created_by = auth.uid()
    )
  );
