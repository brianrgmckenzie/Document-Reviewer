-- Companies (top-level tenant)
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Company members — only 'admin' role for now; project-level access is project_members
create table company_members (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

-- Add company ownership to projects
alter table projects add column company_id uuid references companies(id);

-- RLS — service role only, same pattern as user_roles and project_members
alter table companies enable row level security;
alter table company_members enable row level security;

create policy "Service role manages companies"
  on companies using (false);

create policy "Service role manages company_members"
  on company_members using (false);
